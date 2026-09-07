# CLAUDE.md

**Read [AGENTS.md](AGENTS.md) first** — project context, stack, the Google Drive
contract, testing and the hard rules live there. This file is only the
working agreement for Claude Code sessions.

## Before you change anything

- The living record is the **claude.ai "ISEE" project** — check the docs there for
  what was decided and why; write a doc back when you finish something substantial.
- Work in `site/`. Content edits go in `content/**`, then re-run
  `python3 site/make_bundle.py` and commit the regenerated `site/content/bundle.json`.

## Before you commit

```bash
cd site && npm run build && npm test        # all four suites must pass
python3 site/make_bundle.py && git diff --exit-code -- site/content/bundle.json
```

If a check fails because the UI legitimately changed, fix the test's assumption —
never delete the check.

## Committing

- **Work on `main`.** One person owns this repo and reviews the change as it is
  made, so a feature branch and a merge back are pure ceremony. Commit to `main`
  and, in a remote session, push it. Branch only when the owner asks for one.
  (A remote session may be *started* on a `claude/…` branch; fast-forward `main`
  to it and carry on there.)
- On the owner's own clone, commit and leave the push to them.
- A push to `main` deploys the site, so the checks above are not optional.
- Commit messages: what changed and *why it was wrong before*, in prose. No
  bullet-point changelogs of file names.
- Trailers:

```
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: <session url>
```

## Things that have bitten before

- Building into `site/dist` on the owner's Mac fails when file deletion is not
  granted. Build to a scratch dir instead: `npx vite build --outDir "$HOME/distcheck" --emptyOutDir`.
- The Google popup cannot be opened without a user gesture, and cannot be reached
  by browser automation. Auth changes are verified with the stub in `test_drive.cjs`.
- `applySeed` and `backfill` run on every load. Both must be idempotent and additive.
- Bumping the Drive `schema` means updating `init`, `merge`, `push` and the drive test.

## Verification habit

Screenshot the page you changed — desktop, phone width, and dark mode — and look
at it before saying it is done. Several regressions in this repo were invisible in
the diff and obvious in the screenshot.
