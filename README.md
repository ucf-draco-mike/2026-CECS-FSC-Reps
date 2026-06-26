# 2026-CECS-FSC-Reps

Recruiting and information site for **College of Engineering and Computer Science
(CECS)** faculty serving on **UCF Faculty Senate** committees for the 2026–2027 year.

Faculty can browse committees, see current CECS representation and open seats, and
volunteer through a form. Volunteer data flows back into the site automatically.

- **Built with:** [Eleventy (11ty)](https://www.11ty.dev/) — a static site generator
- **Hosted on:** GitHub Pages
- **Form backend:** [Formspree](https://formspree.io/) (form `xojoddwa`)
- **Data-back loop:** a scheduled GitHub Action pulls submissions from the Formspree
  read-only API and writes them to `src/_data/signups.json`, which the site renders.

---

## Project layout

```
src/
  _data/
    site.js            Global metadata (titles, contact, Formspree id, URL)
    committees.json    Committee catalog: members + open CECS seats  ← EDIT THIS
    committeeDetails.json  Per-committee purpose, tl;dr, duties, cluster ← EDIT for content
    governance.js      Clusters + authority chain for /how-it-works/ ← EDIT to retune map
    signups.json       GENERATED volunteer data (do not edit by hand)
    updates.json       News/share-out posts ← EDIT to post updates
    stats.js           DERIVED statistics for /stats/ (computed; do not edit)
  _includes/           Layouts and partials (base, header, footer, committee card)
  assets/              CSS + JS
  index.njk            Home
  committees.njk       All committees (open seats + represented)
  committee.njk        Per-committee detail pages (one per committee)
  how-it-works.njk     Governance map: how committees connect and report up
  stats.njk            Stats dashboard (representation by department, role, term…)
  signup.njk           Volunteer form (posts to Formspree)
  updates.njk          Updates feed
  about.njk            About / privacy
scripts/
  sync-formspree.mjs   Pulls submissions → signups.json (privacy-filtered)
.github/workflows/
  deploy.yml           Build + deploy to GitHub Pages
  sync-submissions.yml Scheduled Formspree sync + redeploy
```

## Local development

```bash
npm install
npm start          # dev server with live reload at http://localhost:8080
npm run build      # production build into _site/
```

## Editing content

- **Committees & seats:** edit `src/_data/committees.json`. Each committee has
  `members` (current confirmed CECS reps) and `openSeats` (vacant seats to recruit).
  Set `openSeats: 0` once a seat is filled. **Never change a committee `id`** after
  people start signing up — ids are how Formspree submissions are matched.
- **Committee purpose / duties / tl;dr:** edit `src/_data/committeeDetails.json`, keyed by
  the same committee `id`. `tldr` is the hover summary on cards; `purpose` and
  `responsibilities` show on the detail page; `cluster` and `reportsTo` drive the
  `/how-it-works/` governance map. Editing this file does **not** affect signup matching.
- **Governance map:** the `/how-it-works/` page groups committees by the `cluster` set in
  `committeeDetails.json`; cluster labels and the authority chain live in
  `src/_data/governance.js`.
- **Post an update:** add an object to the top of `posts` in `src/_data/updates.json`.
- **Titles / contact / academic year:** edit `src/_data/site.js`.

> **Stats page** (`/stats/`) is fully automatic. `src/_data/stats.js` derives
> everything — seats by department, role and term-length breakdowns, a term-renewal
> timeline, and faculty serving on multiple committees — from `committees.json` and
> `signups.json`. It rebuilds on every change to those files; there is nothing to edit.
> Department names are canonicalized there (e.g. "… and …" → "… & …") so spelling
> variants in the catalog roll up into a single department.

> ⚠️ The committee data was seeded from the 2026–2027 CECS Committee Vacancies sheet.
> Verify names, terms, and seat counts against the official list:
> https://facultysenate.ucf.edu/committees/

## One-time setup

### 1. Formspree secret

The sync uses a **read-only** Formspree API key. The form id (`xojoddwa`) is public
and safe to ship; the API key must stay secret.

1. In the repo, go to **Settings → Secrets and variables → Actions**.
2. Add a repository secret named **`FORMSPREE_API_KEY`** with your Formspree
   read-only API key.
3. (Optional) Add a repository *variable* `FORMSPREE_FORM` to override the form id
   (defaults to `xojoddwa`).

> Master/read-write keys are **not** needed here and should not be used. Only the
> read-only key is required to fetch submissions.

### 2. Enable GitHub Pages

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually). The site
   publishes at `https://<owner>.github.io/2026-CECS-FSC-Reps/`.

> The build sets `PATH_PREFIX=/2026-CECS-FSC-Reps/` so links/assets resolve under the
> project path. If you switch to a custom domain, change `PATH_PREFIX` to `/` in
> `.github/workflows/deploy.yml` and update `url` in `src/_data/site.js`.

## How the volunteer data loop works

1. A faculty member submits the form on `/signup/` → Formspree stores it.
2. **Sync Formspree submissions** runs on a schedule (06:00 & 18:00 UTC) or on demand
   via the Actions tab. It calls `scripts/sync-formspree.mjs`, which:
   - fetches submissions with the read-only API key,
   - matches each selected committee to a committee `id`,
   - writes **only name + department** to `src/_data/signups.json`
     (emails, notes, and metadata are intentionally dropped), and
   - commits the file if it changed.
3. The same workflow then rebuilds and redeploys the site, so committee pages show the
   updated volunteer lists.

Run it locally to preview:

```bash
FORMSPREE_API_KEY=your_readonly_key npm run sync
npm run build
```

## Privacy

Volunteers' **name and department appear publicly** on committee pages (to show momentum
and avoid duplicate sign-ups). **Email and notes are never published** — they live only
in Formspree for the CECS rep to follow up.
