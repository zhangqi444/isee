#!/usr/bin/env python3
"""Turn a review JSON file into what the site and Drive need.

    python3 tools/review_link.py review.json            # prints the import link
    python3 tools/review_link.py review.json --doc      # prints the Google-Doc text instead

A review is feedback on one essay, or on a whole plan week or month; a week or
month review can also carry follow-up actions for named weeks. The format is
docs/review.md. This checks it against content/essay.json (week ids, rubric
dimensions) so a typo cannot reach her, then base64url-encodes it into
https://learning.sheilazhang.org/#/import/<payload>.
"""
import base64, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://learning.sheilazhang.org/"


def load_content():
    essay = json.loads((ROOT / "content" / "essay.json").read_text())
    mocks = json.loads((ROOT / "content" / "mock_essays.json").read_text()) if (ROOT / "content" / "mock_essays.json").exists() else {}
    weeks = set(essay["weeks"].keys())
    dims = [d["name"] for d in essay["rubric"]["dimensions"]]
    forms = set()
    for k, v in (mocks.items() if isinstance(mocks, dict) else []):
        if isinstance(v, dict) and "id" in v: forms.add(v["id"])
        elif isinstance(v, list): forms.update(x.get("id") for x in v if isinstance(x, dict))
    forms |= {"DGN", "M01", "M02", "M03"}
    return weeks, dims, forms


def check(r):
    weeks, dims, forms = load_content()
    errs = []
    t = r.get("target") or {}
    kind = t.get("kind")
    if kind in ("essay", "week"):
        if t.get("wk") not in weeks: errs.append(f"target.wk must be one of {sorted(weeks)}")
    elif kind == "mock":
        if t.get("form") not in forms: errs.append(f"target.form must be one of {sorted(forms)}")
    elif kind == "month":
        if not re.fullmatch(r"\d{4}-\d{2}", str(t.get("m", ""))): errs.append("target.m must be YYYY-MM")
    else:
        errs.append("target.kind must be 'essay'/'week' (with wk), 'mock' (with form) or 'month' (with m)")
    if not str(r.get("summary", "")).strip(): errs.append("summary is required")
    if not str(r.get("reviewer", "")).strip(): errs.append("reviewer is required, e.g. 'Claude, asked by Dad'")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T[\d:.]+Z?", str(r.get("at", ""))): errs.append("at must be an ISO timestamp, e.g. 2026-09-05T18:00:00Z")
    for k in ("strengths", "suggestions"):
        if not isinstance(r.get(k, []), list): errs.append(f"{k} must be a list of sentences")
    if len(r.get("suggestions", [])) > 3: errs.append("at most three suggestions — she is ten")
    if not r.get("strengths"): errs.append("name at least one strength before any suggestion")
    acts = r.get("actions", [])
    if not isinstance(acts, list): errs.append("actions must be a list")
    elif len(acts) > 8: errs.append("at most eight follow-up actions")
    else:
        for i, a in enumerate(acts):
            if not isinstance(a, dict) or not str(a.get("text", "")).strip():
                errs.append(f"actions[{i}] needs a text"); continue
            wk = a.get("wk") or (t.get("wk") if kind == "week" else None)
            if wk not in weeks: errs.append(f"actions[{i}].wk must be one of {sorted(weeks)}")
    if kind in ("week", "month") and r.get("rubric"): errs.append("a week or month review has no rubric; rate dimensions on an essay review")
    for k, v in (r.get("rubric") or {}).items():
        if k not in dims: errs.append(f"rubric '{k}' is not a dimension; use {dims}")
        elif not (isinstance(v, int) and 1 <= v <= 4): errs.append(f"rubric '{k}' must be 1–4")
    return errs


def link(r):
    raw = json.dumps(r, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return SITE + "#/import/" + base64.urlsafe_b64encode(raw).decode().rstrip("=")


def doc(r):
    t = r["target"]
    what = {"essay": lambda: f"Essay {t['wk']}", "week": lambda: f"week {t['wk']}",
            "month": lambda: f"month {t['m']}", "mock": lambda: f"Mock {t.get('form')} essay"}[t["kind"]]()
    lines = [f"Review of Sheila's {what}", f"By {r['reviewer']} · {r['at'][:10]}"]
    if r.get("source"): lines.append(f"Read from {r['source']}")
    lines += ["", r["summary"], ""]
    if r.get("strengths"): lines += ["What worked"] + [f"• {s}" for s in r["strengths"]] + [""]
    if r.get("suggestions"): lines += ["Try this"] + [f"{i + 1}. {s}" for i, s in enumerate(r["suggestions"])] + [""]
    if r.get("next"): lines += [f"For next week: {r['next']}", ""]
    if r.get("rubric"): lines += ["Rubric (1–4)"] + [f"• {k}: {v}" for k, v in r["rubric"].items()] + [""]
    if r.get("actions"):
        lines += ["On the checklist"] + [f"• [{a.get('wk') or t.get('wk')}] {a['text']}" for a in r["actions"]] + [""]
    lines += ["Open it on the site: " + link(r)]
    return "\n".join(lines)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    r = json.loads(Path(sys.argv[1]).read_text())
    errs = check(r)
    if errs:
        sys.exit("review.json is not right yet:\n  - " + "\n  - ".join(errs))
    print(doc(r) if "--doc" in sys.argv else link(r))
