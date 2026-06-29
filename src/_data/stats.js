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

import { DEPARTMENTS, TOTAL_SIZE, classifyDept } from "../../lib/departments.js";

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
  // Canonicalize through the shared department registry so the same unit spelled
  // different ways across the catalog and the signups ("Electrical & Computer
  // Engineering" vs "Electrical and Computer Engineering (ECE)") rolls up into one
  // row instead of fragmenting. Departments outside the seven sized units (e.g. a
  // research center) fall back to their cleaned name.
  const deptMap = new Map();
  const bump = (rawName) => {
    const hit = classifyDept(rawName);
    const key = hit ? hit.key : `other:${rawName.toLowerCase()}`;
    const name = hit ? hit.name : rawName;
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

  // --- Representation normalized by department size ----------------------
  // Bigger departments are expected to hold proportionally more seats. We map
  // every filled seat and every volunteer to one of the seven sized CECS units,
  // then compare each unit's *share of seats* to its *share of faculty size*.
  // parity = seatShare / sizeShare: 1.0 is exactly proportional, <1 is
  // under-represented for its size, >1 is over-represented.
  const sizeBuckets = new Map(
    DEPARTMENTS.map((d) => [d.key, { ...d, seats: 0, volunteerPeople: new Set() }])
  );
  for (const s of seats) {
    const dept = classifyDept(s.department);
    if (dept) sizeBuckets.get(dept.key).seats += 1;
  }
  for (const v of volunteers) {
    const dept = classifyDept(v.department);
    if (dept && v.name) sizeBuckets.get(dept.key).volunteerPeople.add(v.name.toLowerCase());
  }
  const classifiedSeats = [...sizeBuckets.values()].reduce((m, b) => m + b.seats, 0);
  const byNormalizedSize = [...sizeBuckets.values()]
    .map((b) => {
      const sizeShare = b.size / TOTAL_SIZE;
      const seatShare = classifiedSeats ? b.seats / classifiedSeats : 0;
      const expectedSeats = classifiedSeats * sizeShare;
      return {
        key: b.key,
        abbr: b.abbr,
        name: b.name,
        size: b.size,
        seats: b.seats,
        volunteers: b.volunteerPeople.size,
        // Seats per unit of department size — the "representation rate".
        perSize: Math.round((b.seats / b.size) * 100) / 100,
        // Share-of-seats vs share-of-size. Rounded to 2 dp for display.
        parity: expectedSeats ? Math.round((b.seats / expectedSeats) * 100) / 100 : 0,
        expectedSeats: Math.round(expectedSeats * 10) / 10,
        sizePct: Math.round(sizeShare * 100),
        seatPct: Math.round(seatShare * 100),
      };
    })
    .sort((a, b) => a.parity - b.parity || b.size - a.size || a.abbr.localeCompare(b.abbr));

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
    byNormalizedSize,
    maxDeptSeats: byDepartment.reduce((m, d) => Math.max(m, d.seats), 0) || 1,
    maxTimeline: termTimeline.reduce((m, y) => Math.max(m, y.count), 0) || 1,
    maxPerSize: byNormalizedSize.reduce((m, d) => Math.max(m, d.perSize), 0) || 1,
    maxParity: byNormalizedSize.reduce((m, d) => Math.max(m, d.parity), 0) || 1,
    hasVolunteers: volunteers.length > 0,
  };
}
