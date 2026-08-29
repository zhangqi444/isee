# ISEE Learning Hub — Drive-First Static PWA Design

**Status:** Approved architecture; written-spec review pending

**Date:** 2026-08-29

**Architecture:** Statically hosted offline-first PWA with Google Drive learner records

**Source system:** Private ISEE Google Sheets workbooks and project source notes, which are excluded from this public repository

## 1. Purpose

Build a maintainable, learner-first ISEE hub for one learner and one family. The hub must cover the full learning cycle rather than only displaying practice content:

- decide what to learn next;
- teach and practice Verbal Reasoning, Quantitative Reasoning, Mathematics Achievement, Reading Comprehension, and essay writing;
- preserve original test attempts;
- explain errors and schedule fresh review;
- plan and record mock examinations;
- show evidence-based progress across knowledge, accuracy, retention, speed, consistency, and endurance;
- keep all learner records in ordinary files that a parent owns and an LLM can read directly.

The first version is a personal/family tool, not a multi-tenant education product.

### 1.1 Document authority

After written approval, this specification supersedes the Google-Sheets architecture in the private project source notes for the new web application. Those notes remain the historical source for learner, workflow, content, and Calm Scholar requirements; their instruction to use Sheets as the runtime architecture no longer applies to this project.

At implementation start, a concise project-root `AGENTS.md` will carry forward the applicable learning invariants, data-preservation rules, visual system, and verification gates. It will classify the existing Sheets workbooks only as migration sources and read-only archive material.

## 2. Approved Direction

The application will be a statically hosted progressive web app. It will have no application server, relational database, embedded LLM service, vector database, or background worker.

```text
Static PWA
  ├── bundled curriculum, questions, rubrics, and UI
  ├── IndexedDB local working store and sync outbox
  ├── Google Identity Services
  └── Google Drive REST API
          ↓
     visible learner-owned Markdown, YAML, JSON, JSONL, and CSV files
```

Google Drive replaces the durable application database for learner-specific records. It must be treated as an append-only document store, not as a transactional database.

## 3. Scope

### 3.1 Included in version one

- Installable responsive PWA that works during temporary loss of connectivity.
- Google account sign-in and separate Drive authorization.
- A visible `ISEE Learning Hub` folder created in the user's My Drive.
- Local-first practice with explicit `Saved locally`, `Syncing`, `Synced`, and `Needs attention` states.
- Today dashboard and weekly learning plan.
- Practice, test, review, essay, and mock-exam workflows.
- Immutable completed-session history.
- Fresh-question spaced review.
- Cross-subject progress and readiness views.
- Parent-facing assignment, visibility, scheduling, and progress controls within the same app. Version one does not include in-app lesson or question authoring.
- One-time build-time migration of current Google Sheets content and preserved learner history. Migration tooling is not part of the learner-facing runtime app.
- AI Review Pack download/export using ordinary files; no model calls from the app.
- Manual backup snapshot download.

### 3.2 Explicit non-goals

- Multiple unrelated families or school-wide accounts.
- Real-time collaborative editing.
- Reliable synchronization while the app is closed.
- Scheduled server-side jobs, emails, or notifications.
- Server-enforced learner/parent roles.
- Secure high-stakes testing or prevention of source inspection. A static client necessarily receives grading material; answer-key concealment is a UX convention, not a security boundary.
- Official ISEE scoring, percentile prediction, or stanine prediction.
- Autonomous LLM grading or recommendations.

## 4. Technology Shape

The implementation will use a client-only TypeScript stack suitable for static hosting:

- React and TypeScript for the application;
- Vite for static builds;
- a service worker and web app manifest for PWA installation and offline shell caching;
- IndexedDB through a small typed persistence adapter;
- schema validation for every content and learner-data record;
- direct Google Identity Services and Drive REST calls from the browser;
- CSS design tokens and reusable UI components for global styling.

Exact dependency versions will be selected and pinned during implementation planning. The architecture must not depend on provider-specific server rendering or server functions.

## 5. Identity and Authorization

### 5.1 User flow

1. The visitor opens the static site.
2. `Sign in with Google` identifies the selected account for the UI.
3. `Connect Google Drive` separately requests `https://www.googleapis.com/auth/drive.file`.
4. On first connection, the app creates its canonical visible folder and seed metadata files.
5. On later connections, the app discovers that folder using its stored Drive file ID or private `appProperties` marker.

Authentication and Drive authorization remain separate because Google Identity Services treats them as separate consent moments.

### 5.2 Security rules

- Request only `drive.file`; never request full-Drive access in version one.
- Keep short-lived Drive access tokens in memory, not local storage or IndexedDB.
- No client secret exists in the shipped application. The OAuth client ID is public configuration.
- Use Drive permissions as the durable data-access boundary.
- Do not treat a decoded browser ID token as authorization for server resources; there are no application server resources.
- Pass the signed-in account as the Drive authorization hint, then compare the signed-in email with the authorized Drive account returned by `about.get`. If they differ, discard the Drive token, preserve local work, and require the user to reconnect with the matching account.
- Display a reconnect action after token expiry and retry the interrupted sync after authorization succeeds.
- Do not use `appDataFolder`; learner records must remain visible, portable, shareable, and directly accessible.

### 5.3 Account assumptions

Version one supports one owning Google account. Ordinary folder sharing is for human access and backup only; a second account cannot operate the app against that shared folder in version one. Managed school-account restrictions are outside the application's control and must produce a clear setup error.

## 6. Content and Learner Data Separation

### 6.1 Bundled application content

Stable teaching material ships with the static site:

```text
content/
  curriculum/
  lessons/
  question-banks/
  review-templates/
  rubrics/
  exam-blueprints/
  plans/
```

Content is Markdown, YAML, or JSON and is validated during the build. Every item has a stable human-readable ID, schema version, content version, subject, skill taxonomy, source/provenance, and answer/rubric version.

Changing bundled curriculum creates a new deployment and increments `content_version`. Completed attempts continue to reference the exact item and version that the learner saw.

Parent content controls select, assign, reveal, hide, or schedule bundled content. Editing lessons, questions, answer keys, rubrics, or taxonomies occurs in the repository and requires validation plus a new static deployment.

### 6.2 Learner-owned Drive records

Changing and learner-specific information lives in Drive:

```text
ISEE Learning Hub/
  README.md
  SCHEMA.md
  hub.json
  learners/
    learner-01/
      profiles/
      plans/
      sessions/
        2026/
          08/
      essays/
      exams/
      corrections/
      summaries/
      exports/
      snapshots/
```

The folder contains raw blob files, not native Google Docs or Sheets. This avoids export transformations and keeps records directly consumable by people and LLM tools.

## 7. Record Model

### 7.1 Common envelope

Every durable record contains:

- `schema_version`;
- `record_type`;
- stable application `record_id`;
- pseudonymous `learner_id`;
- ISO 8601 `created_at` and, where applicable, `occurred_at`;
- `device_id` generated locally;
- `content_version` and applicable rubric/taxonomy versions;
- `supersedes_record_id` when correcting an earlier record;
- `source` and migration provenance;
- deterministic `content_hash`, calculated from canonical UTF-8 content with the hash field itself excluded.

Unknown values use an explicit `unknown` value where the schema allows it. Meaning must never depend on file order, color, spreadsheet position, or a hidden formula. Drive filenames are descriptive only; identity comes from the record ID and Drive file ID.

### 7.2 Completed session

One completed practice, test, review, or exam section becomes one self-contained immutable JSON file. A completed essay becomes one Markdown file with validated YAML front matter so its prose and structured metadata commit together. A session record includes:

- session mode and subject;
- start, completion, active duration, and pause data;
- plan/task reference;
- ordered item attempts;
- an immutable snapshot for every presented item, including prompt, answer choices where applicable, correct answer, explanation, skill IDs, source/provenance, and all applicable versions;
- learner response, confidence, and optional explanation;
- deterministic correctness and timing results;
- first-attempt snapshot;
- answer/rubric version;
- derived missed skill IDs and review candidates.

Answers are saved continuously to IndexedDB while a session is active. The app creates the immutable Drive record only when the learner submits or explicitly finalizes the session. Cross-device continuation of an unfinished session is not supported in version one.

### 7.3 Plans and profiles

Plans and profiles use immutable versioned snapshots. Updating a plan writes a new file that identifies the previous version. If two valid latest versions exist, both are preserved and the app asks the parent which one should become current; it never silently overwrites either version.

### 7.4 Corrections and deletion

Durable learning evidence is not hard-deleted through the normal UI. A correction or tombstone record references the original ID and records the reason. Dashboards apply the correction while retaining original history.

### 7.5 Derived data

Weekly summaries, indexes, and manifests are rebuildable caches. They may improve startup speed, but raw immutable records remain authoritative. Deleting a derived file must never destroy learning evidence.

## 8. Local-First Synchronization

### 8.1 Write path

```text
UI action
  → validate typed record
  → write IndexedDB transaction
  → enqueue immutable Drive operation
  → upload with stable pre-generated ID
  → verify Drive metadata/readback
  → mark local operation synced
```

The learner receives immediate local confirmation; normal practice never blocks on network latency.

### 8.2 Idempotency

- Generate stable record and Drive upload IDs before the first upload attempt.
- Retrying an uncertain upload reuses the same ID.
- A duplicate/409 response triggers readback and hash comparison rather than creating another record.
- Never retry an operation by silently generating a new identity.

### 8.3 Read path

- Start from IndexedDB for fast offline rendering.
- When Drive is authorized, read the stored change-page token and fetch every paginated change since the last successful sync, filtering to tracked app-created records.
- For an initial rebuild, obtain a change start-page token first, recursively scan every paginated app-created folder listing with `trashed=false`, then replay changes from that token. This prevents a write during the scan from being missed.
- If no valid local folder ID is available, discover roots by the private marker. If exactly one valid root exists, adopt it. If multiple roots exist, show their creation and activity metadata and require the parent to select one; never merge them automatically.
- A moved root remains valid because its Drive file ID is stable. A trashed root is not replaced automatically: the app offers to open Drive for restoration or, after explicit confirmation, create a new empty root.
- Validate schemas and hashes before incorporating remote files.
- Quarantine malformed or future-schema records and show a non-destructive recovery message.

### 8.4 Conflict policy

Completed sessions are immutable and therefore do not conflict. Mutable concepts use versioned snapshots. Concurrent latest plan/profile versions are preserved and require an explicit selection. Derived summaries can always be discarded and rebuilt.

## 9. Learning Experience

### 9.1 Primary navigation

- **Today:** next action, due review, estimated workload, and continue-local-session action.
- **Plan:** weekly goals, calendar, rest/flexible days, and exam milestones.
- **Learn & Practice:** subject lessons and practice sets.
- **Review:** due vocabulary and skills using fresh questions.
- **Mock Exams:** examination plan, timed sections, endurance records, and reflections.
- **Progress:** subject evidence and multidimensional readiness.
- **Writing:** prompt bank, idea bank, outline, essay, and reflection.
- **Library:** lessons, vocabulary, worked examples, and reading guidance.
- **Parent:** plan editing, snapshot restore, backups, synchronization diagnostics, and AI Review Packs.

### 9.2 Today-first behavior

The initial screen must answer `What should I do next?` before displaying secondary metrics. It shows a deliberately small set of actions:

1. required due review;
2. current planned learning session;
3. optional extension work;
4. rest/flexible-day message when appropriate.

### 9.3 Practice and test integrity

- Practice is editable and retryable.
- Tests and mock exams latch the original submitted response.
- Submission shows score, correct/wrong state, correct answer, and concise explanation.
- A later correction never rewrites the original attempt.
- Answer keys are not shown through ordinary UI before submission, while acknowledging that a client-only static app cannot provide adversarial answer-key secrecy.

### 9.4 Review schedule

Missed vocabulary and skills become review candidates. Review questions test the same skill with new content rather than replaying the exact missed item.

Default progression:

1. Review 1: the next learner-local calendar day;
2. Review 2: three learner-local calendar days after successful Review 1;
3. Review 3: seven learner-local calendar days after successful Review 2;
4. Mastered.

The learner profile stores an IANA timezone, initially `America/Los_Angeles`. Calendar-day arithmetic uses that timezone rather than elapsed 24-hour periods. An incorrect review preserves the current stage and schedules a new fresh item for the next local calendar day. Two consecutive incorrect reviews elevate the skill to the next learning plan. A later miss on a mastered skill reopens it at Review 1. The app calculates due work locally whenever it opens. Correct results are preserved, and the original miss stays visible in history.

### 9.5 Examination plan

The hub separates learning readiness from test endurance. Mock-exam records include section order, timing, breaks, omissions, accuracy, confidence, and fatigue/reflection. Progression moves from individual timed sections toward a full ISEE-length sequence before the target examination period.

### 9.6 Readiness reporting

Readiness is never collapsed into a single naive score. The dashboard reports:

- knowledge coverage;
- recent accuracy;
- delayed retention;
- speed and completion;
- consistency across sessions;
- endurance across section order;
- active review load;
- evidence sufficiency.

Official percentiles or stanines are never inferred from internal practice data.

## 10. AI-Ready Data Without AI Infrastructure

The app provides client-generated review packages. It does not call an LLM.

Exports include:

```text
isee-ai-review/
  REVIEW_REQUEST.md
  LEARNER_CONTEXT.md
  WEEKLY_SUMMARY.md
  learning-plan.yaml
  sessions.jsonl
  skill-evidence.csv
  representative-errors.md
  rubric.md
  SCHEMA.md
```

The default package is pseudonymous and omits account email, school, birth date, address, and unrelated Drive metadata. Raw essay inclusion is an explicit parent-controlled option. Each request instructs the LLM to cite record/skill IDs, distinguish facts from interpretation, and avoid invented official scores.

## 11. Migration from Google Sheets

The six active workbooks remain the source of historical truth until migration validation succeeds:

- private Dashboard workbook;
- private Verbal Reasoning workbook;
- private Quantitative Reasoning workbook;
- private Mathematics Achievement workbook;
- private Reading Comprehension workbook;
- private Essay workbook.

Migration will:

1. use the already connected Google Drive integration and the explicit source file IDs to export the six workbooks for a local, development-time transformation; the shipped app's `drive.file` scope does not attempt to read those pre-existing workbooks;
2. transform stable lessons, questions, answer keys, rubrics, plans, and skill mappings into validated bundled content files;
3. transform historical first attempts, review state, and summaries into a private versioned learner-record bundle;
4. attach source workbook, tab/range, and migration timestamp provenance;
5. after the user creates the new canonical Drive root, upload the private learner records directly to that root as a one-time operator step rather than through an ongoing in-app import surface;
6. compare subject/session/question counts and representative calculations with the Sheets source;
7. keep the existing Drive folder and workbooks unchanged as a read-only archive until the family accepts the new hub.

Development migration tooling may be stored in the repository, but exported workbooks, learner answers, private migration bundles, and direct identifiers must be git-ignored and must never enter the public static build. The private migration manifest and reconciliation report live in the learner-owned Drive root.

The legacy combined vocabulary workbook remains backup/reference only.

## 12. Visual and Interaction System

The app carries forward the existing **Calm Scholar** system as global design tokens and reusable components.

- Primary navy: `#1F3A5F`.
- Body slate: `#1F2937`.
- Surface gray: `#F5F7FA`.
- Subject accents: VR `#7257A5`, QR `#2D7593`, MA `#2A7F78`, RC `#3F7D5A`, Essay `#B7791F`.
- Editable/input emphasis: `#FFF2CC` plus an explicit text label.
- Success: `#E2F0D9`; incorrect: `#F4CCCC`; review due: `#FCE4D6`; instructions: `#EAF1F6`.

Global rules:

- Never communicate status by color alone.
- Use readable fluid typography, comfortable line length, and generous spacing.
- Prioritize learner actions over charts and implementation details.
- Use at least 44-by-44 CSS-pixel interactive targets.
- Support keyboard use, visible focus, semantic headings, screen-reader labels, reduced motion, and WCAG AA contrast.
- Long questions, passages, explanations, and prompts must wrap without clipping at supported phone, tablet, and desktop widths.
- Keep parent diagnostics out of the learner's primary flow.
- Add charts only when enough history exists to make them actionable.

The root `AGENTS.md` will be the implementation source of truth for these UI rules, data preservation constraints, and verification gates.

## 13. Failure Handling and Recovery

| Condition | Required behavior |
| --- | --- |
| Offline | Continue from IndexedDB and queue writes. |
| Access token expired | Preserve work, show reconnect, resume the same operation after authorization. |
| Drive permission denied/revoked | Keep local data, explain what is unsynced, and offer reconnect/export. |
| Duplicate/uncertain upload | Reuse the stable ID, read back, and compare the hash. |
| Malformed remote file | Quarantine it locally; never overwrite or delete it automatically. |
| Unsupported future schema | Leave it untouched and explain that the app must be updated. |
| Concurrent plan versions | Preserve both and request parent resolution. |
| Local storage pressure | Warn before data loss and prioritize export/sync; never claim a record is synced when it is not. |
| Drive rate/service error | Apply bounded exponential backoff and retain the outbox item. |

The application never hides synchronization failure behind a generic success message.

## 14. Backup and Portability

- Provide a manual `Download complete snapshot` action that creates a ZIP with a manifest and hashes.
- Provide a restore-preview flow that validates a snapshot before importing it.
- Never auto-delete Drive history during restore.
- Encourage an occasional backup outside the same Google account; a copy in the same Drive does not protect against account loss.
- Do not rely on Drive revision retention as the only backup mechanism.

## 15. Testing Strategy

### 15.1 Automated

- Unit tests for deterministic scoring, review scheduling, readiness metrics, record IDs, hashes, and schema migrations.
- Property/fixture tests ensuring first-attempt snapshots cannot be overwritten.
- IndexedDB adapter tests with offline, restart, quota, and outbox scenarios.
- Drive adapter contract tests using recorded/mock API responses for auth expiry, 409 duplication, 403 permission loss, 429 rate limits, and malformed files.
- Component tests for learner flows and all explicit status labels.
- End-to-end tests for install/load, offline session completion, reconnection, upload verification, reload reconstruction, plan conflict resolution, export, and restore preview.
- Accessibility checks and keyboard navigation tests.
- Build-time validation of every content file and cross-reference.

### 15.2 Visual verification

Verify learner-facing pages at representative phone, tablet, laptop, and desktop widths. Text visibility is a release gate: titles, instructions, questions, options, passages, prompts, feedback, explanations, and actions must be fully readable without overlap or clipping.

### 15.3 Migration verification

Compare imported totals and sampled records against the Sheets workbooks. No source workbook is retired until counts, formulas/results, first attempts, active review items, and representative learner flows agree.

### 15.4 Supported storage conditions

- Primary supported clients are the current Safari on macOS/iPadOS and current Chrome on macOS; current Chrome or Edge on Windows is secondary support.
- Private/incognito browsing is unsupported because durable IndexedDB and PWA behavior are not guaranteed.
- Request persistent browser storage where the platform supports it and report whether it was granted.
- Limit one active draft to 5 MB and warn when the unsynced outbox reaches 50 MB; both boundaries receive automated tests.
- A local-durability guarantee begins only after the IndexedDB transaction confirms success and assumes the user does not clear site data or lose the device. The UI must explain these boundaries and offer immediate export when Drive is unavailable.

## 16. Delivery Milestones

Version one is delivered through independently demonstrable milestones rather than one all-at-once release.

| Milestone | Deliverable | Exit evidence |
| --- | --- | --- |
| M0 — Foundation | Project instructions, design system, content schemas, local store, Google account binding, Drive root creation/recovery, sync outbox, diagnostics | Static build, schema tests, offline storage tests, auth/sync contract tests |
| M1 — Complete vertical slice | Today → one QR learning/test session → immutable submission → feedback → fresh scheduled review → Progress | End-to-end offline/reconnect/reload test with logical single-record synchronization |
| M2 — Full learning hub | VR, QR, MA, RC, Writing, weekly Plan, Library, Parent controls, full validated Sheets migration | Subject reconciliation reports, cross-subject readiness tests, responsive/accessibility verification |
| M3 — Examination and portability | Mock-exam/endurance flow, AI Review Packs, snapshot download, restore preview | Exam-flow tests, de-identification checks, snapshot round-trip validation |

Each milestone must preserve prior milestone data and pass its own automated and visual gates before the next begins.

## 17. Deployment and Operations

- Produce static files deployable to any HTTPS static host with SPA fallback support.
- Configure the production origin in the Google OAuth client.
- Use no runtime secret or server environment dependency.
- Cache the app shell and versioned content; never cache Google access tokens.
- Show app version, content version, schema version, last local save, and last successful Drive sync in diagnostics.
- A content update must not block access to locally saved learner work.

## 18. Acceptance Criteria

Version one is acceptable when all of the following are demonstrated:

1. The production build is static and runs without an application server or database.
2. A user can sign in, authorize only `drive.file`, and create/recover the canonical visible folder.
3. A learner can complete a practice session fully offline, close/reopen the app, and retain the draft locally.
4. A finalized session produces logically one authoritative Drive record even if upload retries make multiple network requests, survives reload on another authorized browser, and preserves the first attempt plus presented-item snapshot.
5. Under the supported storage conditions, token expiry or network failure cannot discard a learner response after its local transaction succeeds.
6. Review work uses fresh items and follows the exact learner-timezone date and failure rules in section 9.4.
7. Today, Plan, Practice, Review, Mock Exams, Writing, Progress, Library, and Parent flows are usable at supported sizes.
8. Progress reports knowledge, accuracy, retention, speed, consistency, endurance, and evidence sufficiency separately.
9. Existing Sheets content and history pass documented migration reconciliation.
10. An exported AI Review Pack can be understood without the website or database and contains no default direct identifiers.
11. A complete snapshot can be downloaded and validated through restore preview.
12. Automated, accessibility, visual, offline, synchronization, and migration verification gates pass.

## 19. Migration Triggers for a Future Database

Drive remains appropriate while the application serves one learner/family with low concurrent write activity. Reconsider a transactional database only if one or more of these become necessary:

- multiple unrelated families;
- simultaneous editors and real-time state;
- secure server-held answer keys;
- unattended/background synchronization;
- scheduled notifications or model evaluation;
- complex server-side analytics;
- transactional updates across multiple records.

If migration is needed, the versioned Markdown/JSON records remain the portable source for importing into Postgres, and Drive can continue as the human- and LLM-readable mirror.

## 20. Primary Platform References

- [Google Identity Services authorization overview](https://developers.google.com/identity/oauth2/web/guides/overview)
- [Google browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google Drive application data folder constraints](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Google Drive change tracking](https://developers.google.com/workspace/drive/api/guides/manage-changes)
- [Google Drive revision behavior](https://developers.google.com/workspace/drive/api/guides/manage-revisions)
