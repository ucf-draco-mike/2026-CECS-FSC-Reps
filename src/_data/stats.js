// Derived statistics for the Stats page.
//
// This is a COMPUTED Eleventy global data file: it reads the committee catalog
// and the (generated) volunteer signups, then derives everything the /stats/
// page renders — counts by department, role, term length, a term-expiration
// timeline, and faculty serving on multiple committees. Nothing here is edited
// by hand; it always reflects the current committees.json + signups.json.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) =>
  JSON.parse(readFileSync(join(here, name), "utf8"));

// Department names arrive in inconsistent spellings across the catalog
// ("Electrical & Computer Engineering" vs "Electrical and Computer
// Engineering", Oxford-comma variants, etc.). Canonicalize to one display
// form so the by-department rollups don't fragment.
function cleanDept(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+and\s+/gi, " & ")
    .replace(/,\s*&/g, " &");
}

const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name);

export default function () {
  const catalog = read("committees.json");
  const signups = read("signups.json");
  const committees = catalog.committees || [];

  // --- Flatten every confirmed CECS rep seat into a row -------------------
  const seats = [];
  for (const c of committees) {
    for (const m of c.members || []) {
      seats.push({
        name: (m.name || "").trim(),
        department: cleanDept(m.department),
        role: (m.role || "Representative").trim(),
        term: m.term || "",
        committeeId: c.id,
        committeeName: c.name,
      });
    }
  }

  // --- Flatten volunteer signups (name + department only) ----------------
  const volunteers = [];
  const byCommittee = signups.byCommittee || {};
  for (const [committeeId, list] of Object.entries(byCommittee)) {
    const committee = committees.find((c) => c.id === committeeId);
    for (const v of list || []) {
      volunteers.push({
        name: (v.name || "").trim(),
        department: cleanDept(v.department),
        committeeId,
        committeeName: committee ? committee.name : committeeId,
      });
    }
  }

  // --- By department: seats, distinct people, distinct committees --------
  const deptMap = new Map();
  const deptKey = (d) => d.toLowerCase();
  const bump = (name) => {
    const key = deptKey(name);
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        name,
        seats: 0,
        people: new Set(),
        committees: new Set(),
        volunteers: 0,
        volunteerPeople: new Set(),
      });
    }
    return deptMap.get(key);
  };
  for (const s of seats) {
    if (!s.department) continue;
    const d = bump(s.department);
    d.seats += 1;
    if (s.name) d.people.add(s.name.toLowerCase());
    d.committees.add(s.committeeId);
  }
  for (const v of volunteers) {
    if (!v.department) continue;
    const d = bump(v.department);
    d.volunteers += 1;
    if (v.name) d.volunteerPeople.add(v.name.toLowerCase());
  }
  const byDepartment = [...deptMap.values()]
    .map((d) => ({
      name: d.name,
      seats: d.seats,
      people: d.people.size,
      committees: d.committees.size,
      volunteers: d.volunteers,
      volunteerPeople: d.volunteerPeople.size,
      count: d.seats, // sort key
    }))
    .sort((a, b) => b.seats - a.seats || b.people - a.people || a.name.localeCompare(b.name));

  // --- By role ------------------------------------------------------------
  const roleMap = new Map();
  for (const s of seats) {
    const role = s.role || "Representative";
    roleMap.set(role, (roleMap.get(role) || 0) + 1);
  }
  const byRole = [...roleMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(byCount);

  // --- By term length (2-year / 3-year) ----------------------------------
  const termMap = new Map();
  for (const c of committees) {
    if (!c.term) continue;
    termMap.set(c.term, (termMap.get(c.term) || 0) + 1);
  }
  const byTermLength = [...termMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(byCount);

  // --- Term-expiration timeline (when seats come up for renewal) ---------
  const yearMap = new Map();
  for (const s of seats) {
    const match = /(\d{4})\s*$/.exec(s.term);
    if (!match) continue;
    const year = match[1];
    yearMap.set(year, (yearMap.get(year) || 0) + 1);
  }
  const termTimeline = [...yearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // --- Faculty serving on more than one committee ------------------------
  const personMap = new Map();
  for (const s of seats) {
    if (!s.name) continue;
    const key = s.name.toLowerCase();
    if (!personMap.has(key)) {
      personMap.set(key, {
        name: s.name,
        department: s.department,
        committees: [],
      });
    }
    personMap.get(key).committees.push(s.committeeName);
  }
  const multiCommittee = [...personMap.values()]
    .map((p) => ({ ...p, count: p.committees.length }))
    .filter((p) => p.count > 1)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // --- Totals -------------------------------------------------------------
  const distinctFaculty = personMap.size;
  const openSeats = committees.reduce((sum, c) => sum + (c.openSeats || 0), 0);
  const seatsFilled = seats.length;
  const committeesWithOpenSeats = committees.filter((c) => (c.openSeats || 0) > 0).length;
  const totalSeats = seatsFilled + openSeats;

  return {
    generatedAt: signups.generatedAt || null,
    totals: {
      committees: committees.length,
      seatsFilled,
      openSeats,
      totalSeats,
      committeesRepresented: committees.length - committeesWithOpenSeats,
      committeesWithOpenSeats,
      distinctFaculty,
      departmentsRepresented: byDepartment.filter((d) => d.seats > 0).length,
      volunteers: volunteers.length,
      coveragePct: totalSeats ? Math.round((seatsFilled / totalSeats) * 100) : 0,
    },
    byDepartment,
    byRole,
    byTermLength,
    termTimeline,
    multiCommittee,
    maxDeptSeats: byDepartment.reduce((m, d) => Math.max(m, d.seats), 0) || 1,
    maxTimeline: termTimeline.reduce((m, y) => Math.max(m, y.count), 0) || 1,
    hasVolunteers: volunteers.length > 0,
  };
}
