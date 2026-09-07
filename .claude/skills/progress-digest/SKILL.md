---
name: progress-digest
description: Sum up a plan week or a month of Sheila's ISEE practice from her progress.json in Google Drive, and hand back a digest with follow-up actions the site can show. Use when asked for a weekly or monthly review, summary, digest or next steps — and when a scheduled Routine fires for one.
---

# Sum up a week or a month

The contract is `docs/review.md`. Read it first. A digest is a review with
`target.kind` `week` or `month`, and it may carry `actions` — follow-ups that
land on a named week's checklist.

Sheila is ten. The digest is written **to her**; the parent reads it with her.
Nothing that makes a slow week feel like failure.

## 1. Read the data

Google Drive → `search_files` for `progress.json` → `read_file_content`. That
one file is the whole record. If it is not there, say so and stop; do not
invent a week.

Work out which period you are summing up:

- **Weekly**: the plan week that just ended. `content/calendar.json` (or the
  `starts` map in `site/content/bundle.json`) gives each week's Monday. If the
  run lands mid-week, sum up the week that has just finished, not the live one.
- **Monthly**: the calendar month that just ended, `YYYY-MM`.

## 2. Work out what actually happened

From `progress.json`, for the period's date range (`at` / `submittedAt` /
`completedAt` timestamps):

- **Sets finished** and their scores: `results[sub:Wn:i]` → `right`/`n`.
- **The review pile**: `items[*]` with `due` — how many came off it (`hist`
  entries with `ctx:"review"` and `ok:true`), how many are still due now.
- **Why misses happened**: the `tag` on each miss — `know`, `misread`,
  `careless`, `rushed`. A cluster is the story of the week.
- **Precision words**: `precision[wk].words` — how many written, confidence.
- **The essay**: `essays[wk]` — plan, draft, time, whether it answered the
  prompt it was asked.
- **Mocks**: `mocks[form]` — sections done, raw scores.
- **Reading**: `books[*].sessions` — reading days in the period.
- **Habits**: active days across everything; do not compute a streak, just say
  how many days had work on them.

Compare against `content/` for what the week was *meant* to hold, so you can say
what was skipped without guessing.

## 3. Write it

- `summary`: two or three sentences on the whole period. Lead with what is true,
  not with what is missing.
- `strengths`: at least one, each naming a real number or a real thing she wrote.
- `suggestions`: at most three, concrete actions, not labels.
- `next`: the one thing to carry into the coming week.
- `actions`: up to eight follow-ups, each `{text, wk, path?}`. This is the point
  of the digest — turn the findings into work that will actually appear on a
  checklist. Aim them at the *coming* weeks, not the one that just ended. Use a
  `path` when there is an obvious page (`/run/<sub>/<wk>/<n>`, `/review`,
  `/precision/<wk>`, `/essay/<wk>`, `/mock/<form>`).
- `reviewer`: "Claude, asked by <parent>" (or "Claude" for a scheduled run).

Two or three actions is usually right. Eight is a wall, and a wall gets ignored.

## 4. Check it, link it, save it

```bash
python3 tools/review_link.py digest.json          # validates, prints the import link
python3 tools/review_link.py digest.json --doc    # the text for the Drive copy
```

Save the `--doc` text as a Google Doc named `Week digest · <W2> · <date>` or
`Month digest · <2026-09> · <date>` in the **Sheila** Drive folder (the one
holding the workbooks and `progress.json`), with `create_file`.

Then give the parent the import link. Opening it shows a preview and an **Add to
Sheila's progress** button; that stores the digest and syncs it to Drive, and the
follow-ups appear on the weeks they name.

Do not commit the digest or her work into the repository.
