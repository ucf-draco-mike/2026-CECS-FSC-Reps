// Governance map definitions for the /how-it-works/ page.
//
// `flow` is the top-down chain of authority that committee recommendations
// ultimately travel through. `clusters` group the committees by domain; each
// committee's `cluster` key in committeeDetails.json decides where it appears.
//
// This is editorial structure, not signup data — safe to edit freely.
export default {
  // Top-down chain: where committee work ultimately bubbles up to.
  flow: [
    {
      title: "Board of Trustees",
      note: "Final authority on programs, budget, and major university policy.",
    },
    {
      title: "President · Provost & VP for Academic Affairs",
      note: "Carry faculty recommendations into university decisions and to the Board.",
    },
    {
      title: "Faculty Senate",
      note: "The elected voice of the faculty. Its Steering Committee is the executive hub that routes work to and from the committees below.",
    },
    {
      title: "Committees & Councils",
      note: "Where the detailed work happens — grouped by domain below. CECS aims to have a representative in every room.",
    },
  ],

  // Domain groupings. `key` matches the `cluster` field in committeeDetails.json.
  clusters: [
    {
      key: "undergraduate",
      label: "Undergraduate Education",
      icon: "▦",
      blurb: "Courses, curriculum, degree requirements, admissions exceptions, and course materials for undergraduate programs.",
      reportsTo: "Dean of the College of Undergraduate Studies → Provost → Board of Trustees",
    },
    {
      key: "graduate",
      label: "Graduate Education",
      icon: "◈",
      blurb: "Policy, curriculum, appeals, and program review for graduate and certificate programs. These committees feed the Graduate Council.",
      reportsTo: "Graduate Council → Dean of the College of Graduate Studies → Provost",
    },
    {
      key: "research",
      label: "Research",
      icon: "✦",
      blurb: "Research policy, centers and institutes, integrity, and internal funding.",
      reportsTo: "VP for Research → Faculty Senate Steering Committee",
    },
    {
      key: "faculty",
      label: "Faculty Affairs",
      icon: "❖",
      blurb: "Personnel policy, promotion & tenure, teaching development, benefits, and travel awards.",
      reportsTo: "Faculty Senate Steering Committee / Provost",
    },
    {
      key: "students",
      label: "Student Success & Experience",
      icon: "★",
      blurb: "Student success and persistence, academic integrity in athletics, and the Honors College.",
      reportsTo: "SVP for Student Success / Faculty Senate",
    },
    {
      key: "operations",
      label: "University Operations & Planning",
      icon: "⬡",
      blurb: "The academic calendar, budget, IT, libraries, campus safety, master planning, commencements, and strategic planning.",
      reportsTo: "Relevant Vice President / Faculty Senate Steering Committee",
    },
  ],
};
