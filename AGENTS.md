# AGENTS.md — Sheila's ISEE prep system

Read this before changing anything. It is the contract for agents and for humans.

## What this is

A prep system for **one child** — Sheila, sitting the **ISEE Lower Level** (entry to
grade 6, autumn 2027 admissions cycle). Two halves:

1. **Google Sheets workbooks** in a Drive folder — the original plan: one workbook
   per subject (VR, QR, MA, RC), plus Essay, Hub, Dashboard and Mock Exams.
   Authored and maintained with Apps Script (`build58.gs`, `RUN_ME.md`).
2. **The practice website** — `site/`, deployed to <https://qizhang.top/isee/>.
   This is where the work happens now. The Sheets are the archive.

Her Week-1 answers were migrated from the Sheets into the site and must never be
lost (see **Hard rules**).

## Repository layout

```
content/                 the source of truth for everything the site teaches
  question-banks/          per-subject question JSON (834 items)
  passages/                reading passages
  precision.json           8 weeks × 20 vocabulary words with meanings
  essay.json               8 weekly prompts, the guide, the rubric
  mock_essays.json         mock exam essay prompts
  calendar.json            researched ISEE dates, formats, school deadlines
  books.json               reading shelf: starter books + suggested reads
  aops.json                ISEE skill → AoPS chapter map
site/
  make_bundle.py           content/** → site/content/bundle.json (the app's only data input)
  build_seed.py *          (repo root) Sheets → site/content/seed.json, her migrated Week-1 work
  src/lib/                 store.js, engine.js, rewards.js, books.js, content.js, aops.js, router.js
  src/pages/               one file per route
  src/components/ui/       shadcn/ui components, written into the repo (not a dependency)
  test_*.cjs               four Playwright suites — see Testing
  oauth.json               the Google OAuth client's public facts (no secrets)
.github/workflows/pages.yml  build + deploy to GitHub Pages
docs/                     architecture.md (how it is built), design.md (why it looks and
                          behaves as it does), essay-review.md, review notes; the living
                          record is the claude.ai "ISEE" project
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite 8**, `base: './'` | static output, works under `/isee/` and inside a single file |
| UI | **React 19** + **Tailwind v4** + **shadcn/ui** | components live in `src/components/ui/`, owned by the repo and editable |
| Icons / charts | **lucide-react**, **recharts 3** | |
| Font | the device's own UI stack (`ui-sans-serif, system-ui, …`) | no webfont request; the PWA and the artifact are self-contained |
| Router | 16 lines of hash routing in `src/lib/router.js` | GitHub Pages has no server-side rewrites |
| State | one plain object + `useSyncExternalStore` (`src/lib/store.js`) | no Redux, no context tree |
| Storage | **localStorage first, Google Drive as the mirror** | see below |
| Hosting | GitHub Pages via Actions | |

**No backend, ever.** There is no server, no database and no account system beyond
Google's. If a feature seems to need one, it is the wrong feature.

## The Google file system

The app is a static page that keeps the learner's data **in her own Google Drive**.

- **Auth**: Google Identity Services token client, OAuth 2.0 implicit flow, scope
  `drive.file openid email profile`. `drive.file` is non-sensitive, so the consent
  screen can stay in **Testing** with the owner as a test user — no Google
  verification, no warning screen. Client id and project are in `site/oauth.json`.
- **Storage**: one file, `progress.json`, in a folder the app creates
  ("Sheila ISEE Practice"). The app can only see files it created.
- **Order of truth**: localStorage is written first and synchronously; Drive is a
  mirror pushed on a 1.2 s debounce. The app is fully usable signed out.
- **Merge** (`Store.merge`): per key, last write wins by `at`; on a tie the richer
  copy is kept. Learning records union their attempt histories. Merging must never
  be able to delete an answer.
- **Payload**: `schema: 5` — `results, precision, essays, mocks, checklists, items,
  mixed, badges, rewards, books, reviews, reviewsSeen, testDate, testFormat, pacing`.
  Adding a slice means bumping the schema, adding it to `init`, `merge` and `push`,
  and covering it in `test_drive.cjs`.
- **Every push reads first**: `flush` runs `pull` (GET, merge, PATCH), so a change
  another device or an outside reviewer put in `progress.json` is merged, never
  overwritten. The `pagehide` keepalive write is the one blind PATCH.
- **Popups**: never call `requestAccessToken` without a click behind it; browsers
  block it. First grant uses `prompt: "consent"`, later ones `prompt: ""`.

**Sign-in follows `zhangqi444/volunteer` (`js/drive.js`).** Ported in full:
`ensureToken()` silently refreshes a stale token before every API call, so the
hourly expiry never reaches the user; `api()` retries once on a 401;
`hasGrantedAllScopes` catches an unticked Drive permission at the source; a
`pagehide` keepalive write saves an edit still inside the debounce; and `dirty`
state plus an `online` listener retries a save that failed.

`SignInDialog` is the welcome screen — an **invitation, not a gate**. The site
works signed out, so "Not now — this device only" is a real answer and is
remembered (`signInAsked`). It returns only when a save has actually failed for
auth reasons (`reconnectNeeded`), never merely because a token aged out.

## Essay reviews

A parent asks Claude to review an essay; the review reaches the site as an import
link (`#/import/<payload>`), is stored in `reviews`, synced to Drive, and shown on
the essay. A Google Doc copy goes in the Drive folder. Contract:
[docs/essay-review.md](docs/essay-review.md); workflow: `.claude/skills/essay-review/`.
Reviews are written to Sheila, never grade-like, and never deleted by the app.

## Data model

Everything derived lives in `src/lib/engine.js` and is computed, never stored:

- `Store.s.results[setId]` — a finished practice set: `{n, right, at, wrong[], picks{}, times{}}`.
- `Store.s.items[questionId]` — the **learning record**: `{hist[], step, due, cleared,
  tag, sure, misses}`. Spaced review, mastery, pacing and the readiness score all
  read from here. `backfill()` creates records for older work; it only ever adds.
- Badges (`Store.s.badges`) are **pinned on first earning** and never recomputed away.

## Commands

```bash
cd site
npm ci
npm run dev                 # local dev server
npm run build               # → site/dist   (the Pages build)
npm run build:artifact      # → ../artifact.html (single file, Drive disabled)
npm test                    # all four Playwright suites
python3 site/make_bundle.py # rebuild bundle.json after editing content/**
```

`make_bundle.py` must be re-run and `site/content/bundle.json` committed whenever
`content/**` changes — CI fails the build if the committed bundle has drifted.

## Testing

Four suites, all real browsers against the built `dist/`:

| Suite | Covers |
|---|---|
| `test_e2e.cjs` | desktop + phone shells, navigation, a full set, persistence |
| `test_drive.cjs` | Google stubbed: sign-in once, reload without a prompt, silent reconnect, merge conflicts, a review arriving from Drive and surviving a save |
| `test_features.cjs` | precision, essay (time log, review import), mocks, calendar, checklist, learning engine, rewards, reading, AoPS pointers |
| `test_artifact.cjs` | the single-file build: no Drive, no external requests, host theme |

Rules: every feature gets checks in the suite it belongs to; a UI change that
breaks a selector means fixing the test's *assumption*, not deleting the check.
All four must pass before a commit.

## UI conventions

- shadcn/ui components only; if one is missing, add it to `src/components/ui/`
  rather than hand-rolling a div.
- Colour has one meaning each: **red** = due now, **amber** = still to do this week,
  **green/success** = done or earned, a **dot** = something new. Never a standing
  count that looks like an alarm.
- Every page must be reachable and escapable from the breadcrumb; the sidebar is
  behind a drawer on phones, so nothing may live only there.
- Container queries (`@md/main:`) rather than viewport breakpoints inside the shell.
- Dark mode is a first-class theme, not an inversion. Tokens in `src/index.css`.
- Numbers use `tabular-nums`. Dates render through `fmtDate`.

## Content rules

- **Never invent a fact.** Dates, deadlines, chapter numbers, page counts and test
  requirements come from a named source or are left out. `calendar.json` and
  `aops.json` carry their sources.
- Vocabulary, explanations and essay guidance are written for a ten-year-old:
  short sentences, concrete examples, no talking down.
- Question banks are fact-checked before they land. A wrong answer key is worse
  than a missing question.

## Hard rules

1. **Learner input is sacred.** Her answers, written responses, essays and ratings
   are never overwritten, migrated destructively, or dropped by a merge. When in
   doubt, keep both copies.
2. **No backend, no accounts, no third-party analytics.** The data belongs to the
   family and stays in their Drive.
3. **A child uses this.** No streak that punishes a missed day, no leaderboard, no
   dark pattern, nothing that makes a bad session feel like failure.
4. **Honest numbers.** A score with no data says "—", not zero. Estimates are
   labelled as estimates (the stanine band says so).
5. `git push` is the owner's. Agents commit; they do not push.
