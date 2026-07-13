// Derived volunteer statistics for the /volunteers/ page.
//
// COMPUTED Eleventy global data: reads the (generated) Formspree signups and the
// committee catalog, then rolls volunteer interest up three ways — by person, by
// department, and by rank — and emits a flat CSV for download. Nothing here is
// edited by hand; it always reflects signups.json + committees.json.
//
// Note: rank and Faculty Senate membership are only present for volunteers whose
// submission included them AND that were synced after the sync script began
// retaining those fields; older rows show as "Not specified".

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { DEPARTMENTS, classifyDept } from "../../lib/departments.js";

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(here, name), "utf8"));

const UNKNOWN_RANK = "Not specified";

// Escape one CSV field per RFC 4180: wrap in quotes and double any inner quotes.
function csvField(value) {
  const s = String(value == null ? "" : value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function () {
  const catalog = read("committees.json");
  const signups = read("signups.json");
  const committees = catalog.committees || [];
  const committeeName = (id) => {
    const c = committees.find((x) => x.id === id);
    return c ? c.name : id;
  };

  // --- Collapse every committee signup into one row per person --------------
  // A volunteer can appear under several committees; merge them by name.
  const people = new Map();
  const byCommittee = signups.byCommittee || {};
  for (const [committeeId, list] of Object.entries(byCommittee)) {
    for (const v of list || []) {
      const name = (v.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!people.has(key)) {
        const dept = classifyDept(v.department);
        people.set(key, {
          name,
          department: v.department ? v.department.trim() : "",
          deptAbbr: dept ? dept.abbr : "",
          deptName: dept ? dept.name : (v.department ? v.department.trim() : "Other"),
          rank: (v.rank || "").trim() || UNKNOWN_RANK,
          senate: (v.senate || "").trim(),
          committees: [],
        });
      }
      const person = people.get(key);
      // Backfill rank/senate if an earlier row lacked it.
      if (person.rank === UNKNOWN_RANK && (v.rank || "").trim()) person.rank = v.rank.trim();
      if (!person.senate && (v.senate || "").trim()) person.senate = v.senate.trim();
      person.committees.push(committeeName(committeeId));
    }
  }

  const byPerson = [...people.values()]
    .map((p) => ({
      ...p,
      committees: [...p.committees].sort((a, b) => a.localeCompare(b)),
      count: p.committees.length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // --- By department: distinct volunteers + total committee selections ------
  const deptOrder = new Map(DEPARTMENTS.map((d, i) => [d.abbr, i]));
  const deptMap = new Map();
  for (const p of byPerson) {
    const keyName = p.deptName;
    if (!deptMap.has(keyName)) {
      deptMap.set(keyName, { name: keyName, abbr: p.deptAbbr, people: 0, selections: 0 });
    }
    const d = deptMap.get(keyName);
    d.people += 1;
    d.selections += p.count;
  }
  const byDepartment = [...deptMap.values()].sort(
    (a, b) =>
      b.people - a.people ||
      (deptOrder.has(a.abbr) ? deptOrder.get(a.abbr) : 99) -
        (deptOrder.has(b.abbr) ? deptOrder.get(b.abbr) : 99) ||
      a.name.localeCompare(b.name)
  );

  // --- By rank: distinct volunteers per rank --------------------------------
  const rankMap = new Map();
  for (const p of byPerson) {
    rankMap.set(p.rank, (rankMap.get(p.rank) || 0) + 1);
  }
  const byRank = [...rankMap.entries()]
    .map(([name, count]) => ({ name, count }))
    // Real ranks first (by count), "Not specified" pinned to the bottom.
    .sort((a, b) => {
      if (a.name === UNKNOWN_RANK) return 1;
      if (b.name === UNKNOWN_RANK) return -1;
      return b.count - a.count || a.name.localeCompare(b.name);
    });

  // --- Downloadable CSV (one row per person) --------------------------------
  const headers = ["Name", "Department", "Rank", "Faculty Senate member", "Committees", "Committee list"];
  const lines = [headers.map(csvField).join(",")];
  for (const p of byPerson) {
    lines.push(
      [
        p.name,
        p.deptName,
        p.rank,
        p.senate || "Not specified",
        p.count,
        p.committees.join("; "),
      ]
        .map(csvField)
        .join(",")
    );
  }
  const csv = lines.join("\r\n") + "\r\n";

  return {
    generatedAt: signups.generatedAt || null,
    totals: {
      volunteers: byPerson.length,
      selections: byPerson.reduce((m, p) => m + p.count, 0),
      departments: byDepartment.length,
      ranks: byRank.filter((r) => r.name !== UNKNOWN_RANK).length,
      hasRanks: byRank.some((r) => r.name !== UNKNOWN_RANK),
      senators: byPerson.filter((p) => p.senate === "Yes").length,
      hasSenate: byPerson.some((p) => p.senate),
    },
    byPerson,
    byDepartment,
    byRank,
    maxPersonCommittees: byPerson.reduce((m, p) => Math.max(m, p.count), 0) || 1,
    maxDeptPeople: byDepartment.reduce((m, d) => Math.max(m, d.people), 0) || 1,
    maxRank: byRank.reduce((m, r) => Math.max(m, r.count), 0) || 1,
    csv,
    hasVolunteers: byPerson.length > 0,
  };
}
