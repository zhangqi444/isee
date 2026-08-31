# Sheila ISEE — Subject Workbook Review

**Date:** 2026-08-31 · **Scope:** VR, QR, MA, RC, Essay, Hub (Mock Exams reported separately)
**Method:** every workbook exported as XLSX and audited programmatically (structure, formulas, keys, validations, hidden state). All 434 subject multiple-choice items re-solved independently before any key was consulted; math verified in Python. Answer-position analysis run by the reviewer directly.

---

## Headline

Two things changed the picture since the 2026-08-29 audit, in opposite directions.

**The content is in far better shape than AGENTS.md records.** RC has been fully rebuilt — the "eight passages reuse one mismatched six-question set and invalid answer key" P0 is closed. Essay has been rebuilt too: instruction, timed draft area, feedback, revision, and wired rubric ratings all now exist. The Hub now has START HERE, STUDY PLAN, SKILL MAP, MOCK PLAN, EXAM PLAN and READINESS. Across VR, QR, MA and RC, **every single answer key is correct** — 434 items, zero key errors.

**But the scoring instruments are compromised in a way no content fix reaches.** Answer positions are algorithmically predictable across most of the system, and the Hub's readiness gates are computed in ways that cannot report failure.

---

## P0 — answer keys are positionally predictable

| Workbook / form | Keys derivable without reading the question |
|---|---|
| Mock DIAGNOSTIC | **127 / 127 (100%)** — strict ABCD cycle, all four sections |
| VR September | **182 / 182 (100%)** — one 16-key motif `CCADBDBCAACBDBDA`, rotated per session |
| MA September | **96 / 96 (100%)** — strict ABCD cycle |
| QR September | 101 / 108 (94%) |
| Mock MOCK 1 | 110 / 127 (87%) |
| Mock MOCK 2 / MOCK 3 | 29% / 36% — chance level, clean |
| RC September | 33% — chance level, clean |

Roughly **616 items** are answerable by pattern alone. Every one of VR's eight sessions matches exactly one rotation of that single motif; there are no exceptions.

Letter *counts* are perfectly balanced everywhere, which is why this survived earlier review — including my own first pass on the Mock workbook, where I checked distribution and not sequence. A repeating cycle produces perfect balance by construction.

Consequence: the split diagnostic is the 100% case and is the first thing Sheila takes. Its scores would set her baseline, populate the skill map, and feed every readiness gate. The whole evidence chain would inherit a number that measures pattern-spotting.

**Remediation built and verified for the Mock workbook:** 254 items re-randomized (940 cell edits), options permuted and key letters updated so the correct answer text is unchanged. Verified across all 508 items — options are a strict permutation, keyed text preserved, no duplicate options, distributions balanced within one, predictability down to 31% against a 25% chance floor. The same treatment is needed for VR, MA and QR.

## P0 — Hub readiness gates cannot report failure

- **Coverage gate is self-referential.** `READINESS!B6` counts rows tagged "Taught" over `SKILL DATA!O8`, which counts the same rows. It can only ever print X / X. It currently reads "36 / 36 exact skills taught" — where those 36 are MA (18) + RC (6) + Essay (12), and **VR and QR contribute zero**. The dashboard reports complete coverage for a system missing two of five subjects.
- **Three of five skill feeds are frozen copies; two are empty.** IMPORTRANGE exists only for VR and QR, and both return nothing. MA, RC and Essay are hard-coded values stamped 2026-08-30.
- **`SYSTEM DATA` has zero formulas.** It is a hand-copied snapshot of the five subject workbooks. `HOME!B5` ("REVIEW FIRST — 5 review items due now") descends from a typed number.
- **Four of eight readiness gates are typed text**, not formulas: Pacing, Stability, Stamina, Well-being.
- **The Essay gate reads a field Essay never fills** — `READINESS!B12` pulls "Overall accuracy" as a percentage, but essays are rated 1–4. It is permanently "Not enough evidence".
- **No data path from the Mock workbook to the Hub** — hyperlinks only. `READINESS!D11` names "Mock SYSTEM SUMMARY" as the Stamina evidence source, which the Hub cannot reach.

## P1 — item-quality defects

**MA (96 items, all keys correct):** twelve clone pairs/triples share both solve and numbers (055/062 are verbatim; 004/024/076 are a triple). Six skill blocks are single generators with shifted numbers, so ~40 of 96 items test at most six distinct behaviors. Three ambiguous scored items — `MA-SEP-086` (paved/closed overlap never specified; two listed options defensible), `MA-SEP-007` and `MA-SEP-015` (stems truncated to "How many campers?" with no predicate). `MA-SEP-025` is non-diagnostic: perimeter and area are both 18.

**QR (108 items, all keys correct):** `W2-S2-Q4` offers `9+9` and `9×2` — both 18, two options eliminable without reasoning. `W3-S2-Q10` says "using the same bag" but the bag is defined only in Q9 — unanswerable if shuffled. Seven near-duplicate pairs; one template ("N objects in a square array") used five times, twice adjacently within a single session. Two items rest on roots of non-perfect squares, mitigated by being answerable through perfect-square bracketing.

**VR (182 items, all keys correct):** only **115 distinct target words across 182 items** — 37% of slots are re-tests, 20 near-verbatim clones (seven pairs are 100% identical stems; `PAINSTAKING` appears twice as a byte-identical item). Eleven cases give the answer away *within the same session*: a word is defined as a synonym stem, then keyed as a completion answer ~10 questions later. A separate mechanical tell: where exactly one option is a phrase rather than a single word, it is the answer **22 times out of 23**. Three ambiguous items (`STATIONARY`, `stable/static`, `consensus/verdict`), three out of level (`suffrage`, `inundated`, `utopia`), three where the keyed synonym is harder than the word being tested.

**RC (48 items, all keys correct):** the cleanest bank in the system. Three low-severity defects — two weak-distractor items solvable without the passage, one skill mislabel (`W4-S1-Q3` tagged Inference but restates the final sentence, which will mis-credit the skill evidence sheets).

## P1 — Essay

- **Mock essay prompts are pre-seen.** `Essay W2!B2` is the same rhetorical task as Mock 3; `PROMPT BANK!C13/C15` overlap Mock 2; hidden `MOCK PROMPTS!D4/D5` duplicate Mock 2 and Mock 4. Three of the four mock essays would be rehearsed and the result would look valid.
- **COMPLETE is unreachable without a hidden-sheet action.** The gate requires six fields on the hidden `ESSAY SUBMISSIONS` sheet with no in-product path to it. Until an adult unhides and fills it, `SYSTEM SUMMARY!B5` and all twelve skill-evidence rows stay pinned at 0 forever.
- **Orphaned legacy block** at rows 3–17 of every weekly sheet — duplicates the live phases, read by no formula, and contains a second inert rating dropdown. This is the "corrected rating inputs" item from the prior audit surviving as a leftover.
- Completion gate contradicts its own instruction: `A49` says revision dates may stay blank; `B18` requires them.

## Verified clean — do not re-flag

All 434 subject keys correct. RC fully rebuilt: 8 distinct passages, 48 unique items, every key correct against its passage, keys at chance, and the rebuild confirmed present in the live workbook (not just the export). Essay GUIDE is a real curriculum — 8 sequenced lessons, 3 annotated models, 7 support banks, a live RUBRIC→reflection→gate rating chain. Hub STUDY PLAN is fully populated (72 dated rows, Sep 7 → Nov 28); SKILL MAP is genuinely live off SKILL DATA (1,205 formulas); EXAM PLAN has real deadline arithmetic and a self-expiring verification stamp. No cached formula errors, no broken references, and every spreadsheet ID referenced across both Hub and Essay is on the approved list.

## AGENTS.md is stale

It still describes Mock Exams as "planned" (it exists, with 508 items), RC as "not learner-ready" (rebuilt), Essay as needing draft/feedback/revision (all present), and the Hub items as "to add" (built). It also lacks the requirement that the Mock workbook's **iterative calculation must stay ON** — verified on 2026-08-30, not stored in the file, and not guaranteed to survive a copy.

## Recommended order

1. Re-randomize answer positions in VR, MA, QR (Mock DGN + M01 already prepared and verified).
2. Fix the Hub coverage gate, wire the five skill feeds, add a Mock→Hub data path.
3. Move the overlapping essay prompts out of the Essay workbook.
4. MA/QR/VR duplicate pruning and the ambiguous stems.
5. Rewrite AGENTS.md against observed state.

*No workbook cells were modified during this review.*
