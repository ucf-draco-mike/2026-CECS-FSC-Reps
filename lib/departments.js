// Canonical CECS department registry, shared by the computed data files
// (src/_data/stats.js, src/_data/volunteerStats.js).
//
// Department names arrive in many spellings across the committee catalog and
// the Formspree signups ("Electrical & Computer Engineering" vs "Electrical and
// Computer Engineering (ECE)", etc.). `classifyDept` collapses any of them to one
// of the seven CECS academic units below, each carrying a relative SIZE weight
// used for size-normalized representation stats.
//
// Sizes are relative faculty-size tiers, not headcounts:
//   ECE = CS = MAE = 5  >  CECE = IEMS = 3  >  MSE = SMST = 2
export const DEPARTMENTS = [
  { key: "CECE", abbr: "CECE", name: "Civil, Environmental & Construction Engineering", size: 3 },
  { key: "CS", abbr: "CS", name: "Computer Science", size: 5 },
  { key: "ECE", abbr: "ECE", name: "Electrical & Computer Engineering", size: 5 },
  { key: "IEMS", abbr: "IEMS", name: "Industrial Engineering & Management Systems", size: 3 },
  { key: "MAE", abbr: "MAE", name: "Mechanical & Aerospace Engineering", size: 5 },
  { key: "MSE", abbr: "MSE", name: "Materials Science & Engineering", size: 2 },
  { key: "SMST", abbr: "SMST", name: "School of Modeling, Simulation & Training", size: 2 },
];

export const TOTAL_SIZE = DEPARTMENTS.reduce((sum, d) => sum + d.size, 0);

const BY_KEY = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d]));

// Ordered keyword/abbreviation matchers. The first hit wins, so the rules are
// written to avoid collisions (e.g. ECE matches "electrical", never "computer",
// so "Computer Science" can't be mistaken for it).
const MATCHERS = [
  ["CS", /\bcomputer science\b|\(cs\)/i],
  ["ECE", /electrical|\(ece\)/i],
  ["CECE", /civil|\(cece\)/i],
  ["IEMS", /industrial|\(iems\)/i],
  ["MSE", /materials|\(mse\)/i],
  ["MAE", /mechanical|aerospace|\(mae\)/i],
  ["SMST", /modeling|simulation|\(smst\)|\bmst\b/i],
];

// Map any department string to its canonical CECS unit, or null if it isn't one
// of the seven sized departments (e.g. a research center).
export function classifyDept(value) {
  const s = String(value || "");
  for (const [key, re] of MATCHERS) {
    if (re.test(s)) return BY_KEY[key];
  }
  return null;
}
