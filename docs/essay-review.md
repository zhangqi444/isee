# Essay reviews — how feedback gets from a reviewer to Sheila

A parent asks Claude (or writes one themselves) to review one of Sheila's essays.
The review is saved with her progress in Google Drive and shows on the site,
on the essay it is about. This is the contract for that.

## Why the review goes in through the site

The site holds only the `drive.file` scope: it can see the files **it** created
and nothing else. A file a reviewer drops into Drive is invisible to it, and the
Drive connector Claude has can create files but cannot edit `progress.json`.
So a review enters through the app and is synced by the app:

1. The reviewer produces a **review** (the JSON below).
2. It is handed to the site as an **import link**,
   `https://qizhang.top/isee/#/import/<payload>`, where the payload is the JSON,
   UTF-8, base64url-encoded without padding. `tools/essay_review_link.py` makes it.
   On a device where the long link is awkward there is a paste box at `#/import`.
3. Whoever opens the link sees a preview and presses **Add to Sheila's progress**.
   The review lands in `Store.s.reviews[id]`, is saved locally, and is pushed to
   `progress.json` in Drive like everything else. From there it reaches every device.
4. A copy of the review is also saved as a Google Doc in the family's
   **Sheila ISEE** Drive folder, so it is readable without the site.

If a future tool *can* write `progress.json` directly, it may put the review
straight into `reviews` there. The site reads the remote copy before every push
(`Store.pull` runs inside `flush`), so a review it has never seen is merged in,
never overwritten.

## The review

```json
{
  "id": "essay:W1:2026-09-05",
  "v": 1,
  "target": { "kind": "essay", "wk": "W1" },
  "at": "2026-09-05T18:00:00Z",
  "reviewer": "Claude, asked by Dad",
  "source": "the Essay workbook in Google Drive",
  "draftAt": "2026-09-03T23:43:21Z",
  "words": 160,
  "summary": "Two or three sentences, to Sheila, about the whole piece.",
  "strengths": ["One specific thing that worked, quoting her words.", "Another."],
  "suggestions": ["One concrete thing to do, not a label.", "At most three."],
  "next": "The one change to carry into next week.",
  "rubric": { "Idea generation": 2, "Structure": 2, "Specificity": 3, "Clarity": 3, "Grammar": 2 }
}
```

| Field | Rule |
|---|---|
| `id` | Unique. `essay:<wk>:<date>` or `mock:<form>:<date>`. A second review of the same essay on a later day is a new id; both are kept. |
| `target` | `{kind:"essay", wk:"W1"…"W8"}` or `{kind:"mock", form:"DGN"|"M01"|"M02"|"M03"}`. Unknown targets are dropped on import. |
| `at` | When it was written. Merge key: for the same id the newer `at` wins. |
| `reviewer` | Who. Name the person who asked as well as the tool: "Claude, asked by Dad". |
| `source` | Optional. Where the reviewer read the essay, in words. Shown on the card. |
| `draftAt` | Optional. When the reviewed draft was last changed. If the essay changes after this, the card says the review is of an older draft. |
| `summary`, `strengths[]`, `suggestions[]`, `next` | Written **to Sheila**, for a ten-year-old: short sentences, her own words quoted back, concrete actions. At least one strength; at most three suggestions. |
| `rubric` | Optional, 1–4 per dimension, names exactly as in `content/essay.json` (`Idea generation`, `Structure`, `Specificity`, `Clarity`, `Grammar`, `Completion time`). Unknown names are dropped. |

`v` is the review format version (1). Anything else is ignored.

## Where it shows

- The essay week page shows the review card under the prompt, above the phase
  tabs, so it is there whichever tab she is on and even if it arrives from Drive
  while the page is open. A mock essay shows it under the submitted text.
- The essay list card gets a **Reviewed** badge; unread reviews carry a dot there,
  on the sidebar's Essay row, and as the first job on the dashboard's Today card.
- Opening the card marks it read (`reviewsSeen`, synced), so the dot goes away on
  every device. A review is never deleted by the app.

## Running a review with Claude

The repo skill `.claude/skills/essay-review/SKILL.md` walks a session through it.
In short: find the essay (in `progress.json` under `essays[wk]` / `mocks[form].essay`,
or in the **Sheila ISEE Essay** workbook for weeks done on paper or in Sheets), read
the week's prompt, focus and rubric from `content/essay.json`, write the review to
her, run `tools/essay_review_link.py` to check it and make the link, save the Doc
copy to the Drive folder, and hand the link to the parent to open.

## Storage and sync

- `Store.s.reviews` — keyed by id; in the Drive payload since schema 5.
- `Store.s.reviewsSeen` — `{[id]: {at}}`, keyed, union across devices.
- Merge: last write wins by `at` per key, like the other keyed slices.
- `test_drive.cjs` covers a review arriving from Drive and surviving a local save;
  `test_features.cjs` covers the import link, the paste box and the unread markers.
