# Weeks 5–8: how to apply this to the Google Sheets

Everything is authored, verified and packaged. The only step left is running one
Apps Script, which I could not do myself because the Chrome extension stopped
responding.

## What it does

Creates **16 new week tabs** (VR, QR, MA, RC × weeks 5–8) plus **4 Essay weeks**,
writes 480 questions and 8 reading passages into them, appends the matching
answer-key rows, re-dates the plan so week 1 is the week Sheila actually started
(31 Aug) instead of 7 Sep, rewrites `AGENTS.md` against observed state,
reconnects the Hub to the subject workbooks, and repairs the Mock workbook.

Every new tab is made by **copying an existing clean week tab**, so all the
formulas, checkboxes, formats and conditional rules come along unchanged.

## Safety

The script never reads or writes a learner-input column, and never touches
`Sep MA W1` or `Sep VR W1`, which hold Sheila's completed work:

- `Sep MA W1` — 24 answers, both sessions submitted
- `Sep VR W1` — 19 written responses, 37 multiple-choice answers, all 3 sessions submitted

`verifyAll()` re-counts both at the end so you can see they survived.

## Steps

1. Open any of the workbooks → **Extensions → Apps Script**.
2. Replace the editor contents with **`build58.gs`** and save.
3. Run the functions **in this order**, checking the log after each:

   | # | Function | What it does |
   |---|----------|--------------|
   | 1 | `selfTest()` | Decodes the payload only — writes nothing. Expect `MA: 4 weeks, 96 rows … VR: 4 weeks, 228 rows`. |
   | 2 | `buildMA()` | 4 MA tabs + 96 key rows |
   | 3 | `buildQR()` | 4 QR tabs + 108 key rows |
   | 4 | `buildRC()` | 4 RC tabs + 48 key rows + 8 passages |
   | 5 | `buildVR()` | 4 VR tabs + 148 key rows |
   | 6 | `buildEssay()` | 4 Essay weeks |
   | 7 | `redatePlan()` | Re-dates weeks 1–4, shifts the Hub plan back 7 days, tags every plan row with the sheet to open |
   | 8 | `updateAgentsDoc()` | Rewrites `AGENTS.md` in Drive against what is actually true now |
   | 9 | `fixHubImports()` | **Reconnects the Hub to the subject workbooks** — see below |
   | 10 | `fixCoverageGate()` | Makes the coverage gate measure against a real planned-domain list |
   | 11 | `extendSubjectSummaries()` | Extends session counting to all eight weeks |
   | 12 | `fixMockContent()` | The 1,462 reviewed mock content fixes — no longer needs the repo push |
   | 13 | `fixMockReadingOptions()` | Removes the mock Reading length tell (see below) |
   | 14 | `fixVRPhraseTell()` | Removes a 96% giveaway in VR weeks 2–4 (see below) |
   | 15 | `verifyAll()`, `auditHub()`, `auditMockReading()`, `auditVRPhraseTell()` | Read-only checks |

## A 96% giveaway is still live in VR

The August review found it and it was never fixed: in the VR September bank,
wherever exactly one option was a *phrase* rather than a single word, that option
was the answer **22 times out of 23**. A student who noticed could score 96% on
those items without knowing a single word.

Fixed by rewriting the single-word distractors so several options are phrases —
no key text changes, no correct answer moves. Only wrong options are edited.

**Week 1 is deliberately excluded.** Sheila has already answered and submitted
those items, and changing option text under a recorded answer would make her
review disagree with what she actually saw. Its three affected items stay as they
were; the twenty items in weeks 2–4, which she has not reached, are repaired.
The script also refuses week-1 writes at runtime as a second guard.

`auditVRPhraseTell()` re-measures it live.

Steps 12 and 13 pause safely at the 6-minute limit and print `PAUSED, run again
to continue` — just run them again until they say `complete`.

## The mock Reading sections were scoreable without reading

The August review checked that answer *letters* were balanced, which they are.
It never checked option *length*. In the mock Reading sections the correct answer
was the strictly longest option in **77 of 100 items**, and the shortest in 1.

Always picking the longest choice scored about **77%** without reading a single
passage — so mock Reading scores were not measuring reading. All 100 items were
repaired: weak distractors lengthened, padded keys trimmed, every distractor
re-checked as still false against its passage. No correct answer moved and no key
gained meaning. It is now 21% longest / 20% shortest, against 25% by chance.

`auditMockReading()` re-measures this in the live workbook after you run step 13.

Steps 12 and 13 make `apply_all.gs` unnecessary — its edits are embedded here, so
nothing waits on the repo push any more.

## The Hub is currently showing numbers that aren't true

Worth knowing before you run step 9. The Hub's `SYSTEM DATA` block contains
**hard-coded numbers, not formulas** — nothing imports anything, so every
cross-category figure has been frozen since the sheet was built. The subject
workbooks compute correctly; the Hub just never reads them.

| | Subject workbook says | Hub says |
|---|---|---|
| VR | 2 sessions done, **81% accuracy**, 64 in review, 20 due | 0 sessions, blank, 5, 5 |
| MA | 2 sessions done, **54% accuracy**, 11 in review | 0 sessions, blank, 0 |

So the dashboard shows a learner who has done nothing. `fixHubImports()` replaces
those literals with real `IMPORTRANGE` feeds and adds the missing Mock block.

**After running it, open the Hub itself.** IMPORTRANGE needs a one-time
"Allow access" click per source — six prompts, one per workbook. Until you click
them the cells read "awaiting access". Then run `auditHub()`, which prints the
subject figure next to the Hub figure so you can see they agree.

One thing I deliberately did **not** fix: the subject `Overall accuracy` and
`Timed accuracy` formulas still reference weeks 1–4 only. They are long and
load-bearing, and I could not test a rewrite against the live sheets, so
reconstructing them blind risked breaking the one part that currently works.
They will keep reporting correctly for weeks 1–4 and silently ignore weeks 5–8.
That needs a hands-on pass.

You will be asked to authorise the script the first time. Each build function
stops safely before the 6-minute limit and **stamps each finished week**, so if
one times out, just run it again — it picks up where it stopped and never
double-writes.

## Week → date map

| Subject week | Dates | Hub week |
|---|---|---|
| W1 | Aug 31 – Sep 6 | 1 |
| W2 | Sep 7 – 13 | 2 |
| W3 | Sep 14 – 20 | 3 |
| — | Sep 21 – 27 | 4 — split baseline mock |
| W4 | Sep 28 – Oct 4 | 5 |
| W5 | Oct 5 – 11 | 6 |
| W6 | Oct 12 – 18 | 7 |
| — | Oct 19 – Nov 8 | 8–10 — mocks and correction |
| W7 | Nov 9 – 15 | 11 |
| W8 | Nov 16 – 22 | 12 |

## Also in this drop

- **The practice site** (`isee-site.zip`) — unzip at the repo root, then
  Settings → Pages → deploy from `/site`. It needs nothing from the Apps Script;
  it already carries all 1,342 questions.
- A live copy is published as an artifact, so you can try it before deciding
  whether to host it.
