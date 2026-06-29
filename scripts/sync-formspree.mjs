#!/usr/bin/env node
/**
 * Sync Formspree submissions into src/_data/signups.json.
 *
 * Pulls volunteer submissions from the Formspree read-only API and writes a
 * privacy-filtered JSON file the site reads. ONLY public fields (name,
 * department, rank) are written; email, notes, and metadata are intentionally
 * dropped.
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

  const byCommittee = {};
  const seen = new Set(); // dedupe key: committeeId|lowercased name
  let counted = 0;

  for (const sub of submissions) {
    const name = String(field(sub, "name", "full name", "_name") || "").trim();
    if (!name) continue;
    const department = String(field(sub, "department", "school", "unit") || "").trim();
    const rank = String(field(sub, "rank", "title", "rank / title") || "").trim();
    const values = committeeValues(sub);
    let matchedAny = false;

    for (const value of values) {
      const id = resolveCommitteeId(value, index);
      if (!id) continue;
      const key = `${id}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const record = { name, department };
      if (rank) record.rank = rank;
      (byCommittee[id] ||= []).push(record);
      matchedAny = true;
    }
    if (matchedAny) counted++;
  }

  // Stable ordering for clean diffs.
  for (const id of Object.keys(byCommittee)) {
    byCommittee[id].sort((a, b) => a.name.localeCompare(b.name));
  }
  const sorted = {};
  for (const id of Object.keys(byCommittee).sort()) sorted[id] = byCommittee[id];

  const output = {
    _note:
      "GENERATED FILE — do not edit by hand. Produced by scripts/sync-formspree.mjs from Formspree submissions. Only name + department + rank are stored (no emails).",
    generatedAt: new Date().toISOString(),
    totalSubmissions: counted,
    byCommittee: sorted,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(
    `Wrote ${OUTPUT_PATH} — ${counted} volunteer submission(s) across ${Object.keys(sorted).length} committee(s).`
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
