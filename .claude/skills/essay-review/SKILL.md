---
name: essay-review
description: Review one of Sheila's ISEE practice essays from Google Drive and hand back a review the site can show. Use when a parent asks to review, mark, give feedback on, or check an essay (a weekly essay W1–W8 or a mock-exam essay).
---

# Review one of Sheila's essays

The contract is `docs/essay-review.md`. Read it first. Sheila is ten; the review
is written **to her**, and the parent reads it with her.

## 1. Find the essay

Use the Google Drive connector. It must be connected to the **same Google
account she signs in to the site with** (the test user in `site/oauth.json`);
`progress.json` lives in that account's Drive and no other. If `search_files`
for `progress.json` finds nothing, say which account the connector sees (the
`owner` of any file it returns) and stop; do not review from memory.

- **Site essays**: search `title = 'progress.json'`, download it, and read
  `essays[wk]` (`plan`, `draft.opening/middle/ending`, `time`, `feedback`, `rubric`,
  `meta.worked/next`, `completedAt`, `at`) or `mocks[form].essay.text`. If the file
  does not exist, she has not connected the site to Drive yet; say so.
- **Workbook essays**: search `title = 'Sheila ISEE Essay'` and read it. Each
  `ESSAY WEEK n` sheet has the prompt, her idea list, chosen idea, the three
  paragraphs (Opening / Specific details / Reflection), her self-check ratings and
  minutes. Week 1 was done there.

Never quote the whole essay back in the review; the site already has it. Quote
short phrases of hers.

## 2. Read the week

From `content/essay.json`: the week's `prompt`, `focus`, `feedback_checks`, and
the `rubric` (`dimensions` with four level names each, `next_steps` per level).
The week's focus decides what the review is mostly about. Week 1 is prompt
interpretation, idea generation, focus; a draft that does not answer the prompt is
the first thing to say, kindly.

## 3. Write the review

Produce the JSON in `docs/essay-review.md`, with:

- `summary`: two or three sentences on the whole piece, warm and honest.
- `strengths`: at least one, each quoting something she actually wrote.
- `suggestions`: at most three, each one concrete thing to do next time, in the
  order of `guide.revision_order` (focus and meaning, then order and support,
  then sentences, then conventions).
- `next`: the one change to carry into next week; take it from the rubric's
  `next_steps` for her level where it fits.
- `rubric`: 1–4 where you have evidence; leave a dimension out rather than guess.
  `Completion time` needs a recorded time.
- `reviewer`: "Claude, asked by <parent>". `source`: where you read it.
- `draftAt`: the file's or workbook's modified time.

Nothing that makes a bad session feel like failure. No grades, no comparisons.

## 4. Check it, link it, save it

```bash
python3 tools/essay_review_link.py review.json          # validates, prints the import link
python3 tools/essay_review_link.py review.json --doc    # the text for the Drive copy
```

Save the `--doc` text as a Google Doc named
`Essay review · <W1 or mock name> · <date>` in the **Sheila ISEE** Drive folder
(the one holding the "Sheila ISEE Essay" workbook), with `create_file`.

Give the parent the import link. Opening it on any device shows a preview and an
**Add to Sheila's progress** button; that stores the review and syncs it to
`progress.json`. The paste box at `#/import` takes the link or the JSON too.

Do not commit the review or her essay into the repository.
