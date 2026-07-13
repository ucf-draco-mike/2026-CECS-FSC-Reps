#!/usr/bin/env node
/**
 * Sync Formspree submissions into src/_data/signups.json.
 *
 * Pulls volunteer submissions from the Formspree read-only API and writes a
 * privacy-filtered JSON file the site reads. ONLY public fields (name,
 * department, rank, Faculty Senate membership) are written; email, notes, and
 * metadata are intentionally dropped.
 *
 * One entry per person — the LATEST submission wins. Re-submitting the form
 * replaces a volunteer's earlier committee selections, and a submission with
 * the withdraw box checked removes them from every committee list.
 *
 * Environment:
 *   FORMSPREE_API_KEY   (required) read-only API key, provided as a repo secret
 *   FORMSPREE_FORM      (optional) form hashid, default "xojoddwa"
 *   FORMSPREE_API_URL   (optional) override the submissions endpoint entirely
 *
 * Run locally:   FORMSPREE_API_KEY=xxx npm run sync
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const COMMITTEES_PATH = resolve(ROOT, "src/_data/committees.json");
const OUTPUT_PATH = resolve(ROOT, "src/_data/signups.json");

const API_KEY = process.env.FORMSPREE_API_KEY;
const FORM = process.env.FORMSPREE_FORM || "xojoddwa";
const API_URL =
  process.env.FORMSPREE_API_URL ||
  `https://formspree.io/api/0/forms/${FORM}/submissions`;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Pull a field from a submission case-insensitively. */
function field(sub, ...names) {
  const keys = Object.keys(sub);
  for (const want of names) {
    const hit = keys.find((k) => k.toLowerCase() === want.toLowerCase());
    if (hit != null && sub[hit] != null && String(sub[hit]).trim() !== "") {
      return sub[hit];
    }
  }
  return "";
}

/** Truthiness of checkbox-ish fields ("yes", "on", "true", "1"). */
function checked(value) {
  return /^(y|yes|on|true|1)$/i.test(String(value || "").trim());
}

/** Normalise the Faculty Senate answer to "Yes" / "No" / "" (not answered). */
function senateValue(sub) {
  const raw = String(field(sub, "senate", "faculty senate", "senate member") || "").trim();
  if (/^y/i.test(raw)) return "Yes";
  if (/^n/i.test(raw)) return "No";
  return "";
}

/**
 * Submission timestamp, for picking a person's most recent submission.
 * Returns null when the API row carries no parseable date.
 */
function submittedAt(sub) {
  const raw = field(sub, "_date", "date", "created_at", "_created_at");
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

/** Normalise the committees field of a submission into an array of values. */
function committeeValues(sub) {
  const raw = field(sub, "committees", "committees[]", "committee");
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    return raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function loadCommitteeIndex() {
  const data = JSON.parse(await readFile(COMMITTEES_PATH, "utf8"));
  const byId = new Map();
  const byNameSlug = new Map();
  for (const c of data.committees) {
    byId.set(c.id, c.id);
    byNameSlug.set(slugify(c.name), c.id);
  }
  return { byId, byNameSlug };
}

/** Map a raw committee value (id or name) to a known committee id. */
function resolveCommitteeId(value, index) {
  const s = slugify(value);
  if (index.byId.has(s)) return index.byId.get(s);
  if (index.byNameSlug.has(s)) return index.byNameSlug.get(s);
  return null;
}

async function fetchSubmissions() {
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Accept: "application/json",
  };
  const all = [];
  let page = 1;
  // Page until an empty/short page comes back (Formspree paginates large forms).
  // Guard with a hard cap so a misbehaving API can't loop forever.
  for (; page <= 100; page++) {
    const url = `${API_URL}${API_URL.includes("?") ? "&" : "?"}page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Formspree API returned ${res.status} ${res.statusText}: ${body.slice(0, 300)}`
      );
    }
    const json = await res.json();
    const batch = json.submissions || json.data || (Array.isArray(json) ? json : []);
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 25) break; // last page
  }
  return all;
}

async function main() {
  if (!API_KEY) {
    console.error("FORMSPREE_API_KEY is not set. Aborting.");
    process.exit(1);
  }

  const index = await loadCommitteeIndex();
  const submissions = await fetchSubmissions();

  // Collapse to one submission per person — the LATEST wins — so re-submitting
  // the form updates (replaces) earlier interest instead of accumulating it.
  // The API returns submissions newest-first, so when a row carries no parseable
  // date the first submission seen for a person is treated as their latest.
  const latest = new Map(); // lowercased name -> { sub, name, at }
  for (const sub of submissions) {
    const name = String(field(sub, "name", "full name", "_name") || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const at = submittedAt(sub);
    const prev = latest.get(key);
    if (!prev || (at != null && prev.at != null && at > prev.at)) {
      latest.set(key, { sub, name, at });
    }
  }

  const byCommittee = {};
  let counted = 0;
  let withdrawn = 0;

  for (const { sub, name } of latest.values()) {
    // A withdrawal removes the person from every committee list.
    if (checked(field(sub, "withdraw", "no longer interested"))) {
      withdrawn++;
      continue;
    }
    const department = String(field(sub, "department", "school", "unit") || "").trim();
    const rank = String(field(sub, "rank", "title", "rank / title") || "").trim();
    const senate = senateValue(sub);
    const ids = [
      ...new Set(committeeValues(sub).map((v) => resolveCommitteeId(v, index)).filter(Boolean)),
    ];
    if (!ids.length) continue;

    const record = { name, department };
    if (rank) record.rank = rank;
    if (senate) record.senate = senate;
    for (const id of ids) (byCommittee[id] ||= []).push(record);
    counted++;
  }

  // Stable ordering for clean diffs.
  for (const id of Object.keys(byCommittee)) {
    byCommittee[id].sort((a, b) => a.name.localeCompare(b.name));
  }
  const sorted = {};
  for (const id of Object.keys(byCommittee).sort()) sorted[id] = byCommittee[id];

  const output = {
    _note:
      "GENERATED FILE — do not edit by hand. Produced by scripts/sync-formspree.mjs from Formspree submissions. Only name + department + rank + Faculty Senate membership are stored (no emails). One entry per person: the latest submission wins, so re-submitting updates or withdraws earlier interest.",
    generatedAt: new Date().toISOString(),
    totalSubmissions: counted,
    byCommittee: sorted,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(
    `Wrote ${OUTPUT_PATH} — ${counted} active volunteer(s) across ${Object.keys(sorted).length} committee(s)` +
      (withdrawn ? `, ${withdrawn} withdrawn.` : ".")
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
