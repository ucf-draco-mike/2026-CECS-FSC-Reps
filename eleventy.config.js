// Eleventy configuration (ESM).
// Docs: https://www.11ty.dev/docs/config/

export default function (eleventyConfig) {
  // Copy static assets straight through to the output folder.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "." });

  // Re-run the dev server when CSS/JS change.
  eleventyConfig.addWatchTarget("src/assets/");

  // --- Filters ---------------------------------------------------------------

  // Turn an arbitrary string into a URL-safe slug. Used to match committee
  // names coming back from Formspree to committee ids in the catalog.
  eleventyConfig.addFilter("slug", (value) =>
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );

  // Human-friendly date formatting.
  eleventyConfig.addFilter("readableDate", (value) => {
    if (!value) return "";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // Count of volunteers for a given committee id from the signups data.
  eleventyConfig.addFilter("signupsFor", (signups, committeeId) => {
    if (!signups || !signups.byCommittee) return [];
    return signups.byCommittee[committeeId] || [];
  });

  // Committees with one or more vacant CECS seats (the recruiting targets).
  eleventyConfig.addFilter("openCommittees", (committees) =>
    (committees || []).filter((c) => (c.openSeats || 0) > 0)
  );

  // Committees whose CECS seats are all currently filled.
  eleventyConfig.addFilter("representedCommittees", (committees) =>
    (committees || []).filter((c) => (c.openSeats || 0) === 0)
  );

  // Total count of open CECS seats across all committees.
  eleventyConfig.addFilter("totalOpenSeats", (committees) =>
    (committees || []).reduce((sum, c) => sum + (c.openSeats || 0), 0)
  );

  // Take the first n items of an array (Nunjucks' built-in `slice` chunks instead).
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));

  // Percentage width (0–100, rounded) of `value` relative to `max`, for the
  // CSS bar charts on the stats page. Guards against divide-by-zero.
  eleventyConfig.addFilter("barPct", (value, max) => {
    const m = Number(max) || 0;
    if (m <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((Number(value) / m) * 100)));
  });

  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
}
