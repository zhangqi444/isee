# Sheila ISEE Mock Exams — Independent Review

**Date:** 2026-08-30 · **Reviewer:** fresh adversarial pass (no edits made)
**Workbook:** `Sheila ISEE Mock Exams` (Drive ID `1LDQEe_NeQUTk_1gMaVXzhDcJgQLb3mPvm7vO8Kseg00`)
**Method:** full XLSX export audited programmatically (structure, keys, formulas, validations, hidden state); all 508 multiple-choice items independently re-solved by six parallel reviewers before comparing to the key; math re-verified in Python. Ten candidate RC findings were withdrawn after being traced to a truncation bug in my own extraction, not the workbook.

---

## Verdict

The workbook is structurally excellent. Every answer key checks out. Nothing here corrupts a submitted attempt. But **8 items test above Lower Level, one item has two identical options, and cross-form vocabulary/template leaks mean the diagnostic pre-teaches parts of Mock 1** — worth fixing before the first administration, and the leaks before Mock 1.

## Verified clean

- **Structure:** 11 sheets as designed. All four forms match the official Lower Level blueprint — VR 34q/20min, QR 38q/35min, RC 5 passages·25q/25min, MA 30q/30min, Essay 30min — with correct section bands and instructions.
- **Answer keys:** 508/508 items present in the hidden ANSWER KEY, zero duplicate IDs, every form item resolves to a key row of the right form. **All 272 math keys re-derived independently and confirmed correct.** All 136 RC keys confirmed answerable and correct against full passage text. Answer-letter distribution is balanced in every section of every form (no exploitable position pattern).
- **Scoring plumbing:** RESULT/CORRECT/EXPLANATION columns gate on the submit latch (`V3`/FORM STATUS) and VLOOKUP into ANSWER KEY with correct column indices; nothing is revealed pre-submit. Section stats (attempted, raw correct, half-split accuracy, avg confidence) reference the right ranges. ATTEMPTS rows map 1:1 to the correct cells of each form; TOTAL/127 only sums when Submitted. SYSTEM SUMMARY counts (forms submitted, open corrections, due retests) reference the right ranges.
- **First-attempt preservation:** the W–Z snapshot columns self-latch (`IF(AND(W20<>"",W20<>0),W20,…)`), so post-submit edits cannot alter the recorded attempt — *conditional on iterative calculation being ON (see Open item)*.
- **Validations:** YOUR ANSWER restricted to A–D, confidence to 1–3, status to Draft/Submitted, flags to No/Yes — all applied to the correct learner ranges.

## Load-bearing setting — verified

**Iterative calculation: ON** (max 1 iteration, threshold 0.05; recalculation "On change") — confirmed in the live sheet on 2026-08-30. The snapshot layer (~2,500 self-referential latch cells) depends on this setting, it is not stored in the file itself, and it does not survive every copy/rebuild. **Record it in AGENTS.md as a required workbook setting** and re-check it after any copy or rebuild of the Mock workbook.

## P1 — fix before the affected form is administered

**Content validity (scores would mis-measure):**
- **P1-1. Eight out-of-level items** (topics 2+ grades above Lower Level; keys are all mathematically correct, the topic is the problem):
  - `DGN-MA-023` circumference C=πd · `M01-MA-021` circle area A=πr² (grade-7 geometry)
  - `M01-QR-035` estimate √130 · `M02-QR-035` estimate √190 (grade-8 radicals; in M02 the key is also the only decimal option — a format cue)
  - `M02-QR-015`, `M03-QR-036` compound probability without replacement (grade 7)
  - `M03-QR-031` octagon interior angle sum (grade 8)
  - Replace with same-skill-family Lower Level items.
- **P1-2. `DGN-MA-005`** — options A (2/5) and B (6/15) are numerically identical; both eliminable without solving. Key D stands; replace one distractor.
- **P1-3. Four ambiguous verbal items** — two defensible answers: `M01-VR-002` (BRISK: quick/chilly), `M01-VR-012` (NEGLECT: ignore/forget), `M02-VR-031` (contradict/exceed both fit), `M03-VR-028` (independent/official both fit). Rewrite stem or replace distractor.

**Cross-form leaks (later forms are not "unseen"):**
- **P1-4. Vocabulary leaks DGN→M01:** *modest/humble* tested three times across the two forms (DGN-VR-011 key ↔ M01-VR-008 target, M01-VR-029 key); *sturdy* (DGN-VR-033 key ↔ M01-VR-016 target); *attentive* keyed in both forms (DGN-RC-008, M01-VR-027). Within-form: DGN keys *careful/carefully* twice (VR-002, VR-018); tested targets recycled as distractors (DGN-VR-013/032, DGN-VR-002/030).
- **P1-5. Template leaks M02→M03:** *support/supported* keyed in both forms (M02-VR-034, M03-VR-030); four near-identical sentence frames (gardener/straw-mulch, "instructions seemed ___", twins/identical, reporter/conflicting-accounts).
- **P1-6. RC passage template repeats DGN→M01:** the "productive silence" closer (DGN-RC-P05 ↔ M01-RC-P05 — same arc, theme items key the same abstraction) and the workshop-helper narrative (DGN-RC-P02 ↔ M01-RC-P02). Rewrite one of each pair.
- **P1-7. Essay prompts all visible on one tab.** ESSAYS shows the DGN, M01, M02, and M03 prompts together, so taking the diagnostic exposes all three future prompts — directly against "Each prompt is unseen." Move undelivered prompts to a hidden area revealed per form, or split per-form.

**Access control:**
- **P1-8. ANSWER KEY is hidden but nothing is protected** (no sheet protection anywhere in the workbook). Unhide is one click away during a timed test. Add sheet protection (warning-level is fine for the deterrent) to ANSWER KEY, and to the backend columns; the pre-test checklist's "remove answer-key access" currently has no mechanism.

## P2 — quality fixes, batchable

- **P2-1. Twelve wrong "why the distractor is wrong" rationales** (learner-facing after submit; keys unaffected): `M02-MA-003`, `M02-QR-023`, `M02-MA-016`, `M02-MA-009`, `M02-QR-033` (Box B / option-B collision), `M03-QR-003`, `M03-QR-007`, `M03-QR-023`, `M03-QR-035`, `M03-MA-022`, `M03-MA-024` — each describes an error path that cannot produce the distractor it claims to explain — plus `M03-RC-011`'s fixed-citation note. Rewrite the explanation text.
- **P2-2. Wording/format:** `M01-MA-023` "one angle of a right angle is 27°" (rewrite as complementary angles); `M03-RC-008` options not grammatically parallel (two infinitives, two sentences — the key is one of the odd pair); `M03-RC-001` stem asks "how it worked," key states the outcome.
- **P2-3. Key-harder-than-stem pairings:** `M01-VR-008` HUMBLE→*unassuming*, `M03-VR-012` MEAGER→*scant* (functional but weakest pairings; DGN-VR-007 HINDER→*obstruct* is a lesser case).
- **P2-4. Cross-form texture echoes:** character names Nia and Mara reused across forms; invented place names *Bellweather* (M02) vs *Bellwater* (M03); "ordinary" appears in five stems across M02/M03. Not answer-revealing; vary for unseen feel.
- **P2-5. Difficulty tags need one calibration pass** (e.g. M01-QR-005 simple percent tagged H while estimation items sit at E).
- **P2-6. Learner-visible backend columns:** only R and V are hidden; T (SOURCE), U (VERSION/HALF) and the W–Z snapshot columns are visible-but-blank clutter on learner tabs. Hide O–Z beyond the learner's last input column (content is blank pre-submit either way, so this is polish plus one less path to confusion).

## Noted, not defects

- CORRECTIONS and DELAYED RETEST are header-only shells with no auto-population of missed items. AGENTS.md's "automatically collect missed words/skills" suggests these should at least pre-fill rows from post-submit misses; the 24–48h classification is legitimately human work. Decide whether auto-fill belongs in scope; if manual is intentional, document that in AGENTS.md.
- HOME → form hyperlinks carry hard-coded `gid=` targets that cannot be checked from the export; click-test the four OPEN links once in the live sheet.
- Essay has no model responses by design (rubric-based) — consistent with AGENTS.md.

## Recommended fix order

1. Click-test the four HOME OPEN links once in the live sheet (gid targets aren't checkable from the export); add the iterative-calculation requirement to AGENTS.md.
2. P1-1/P1-2/P1-3 item replacements in DGN + M01 (needed before the split diagnostic).
3. P1-4…P1-7 leak repairs (before Mock 1; M02/M03 pairs can trail).
4. P1-8 protection.
5. P2 batch in one styling-safe pass, then re-run the mutation test and refresh the repo workbook source.

*All findings verified against the live export of 2026-08-30 16:04 UTC; no workbook cells were modified during this review.*
