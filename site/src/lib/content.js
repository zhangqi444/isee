/* Question-bank helpers. `D` is the bundle (window.__ISEE__ or content/bundle.json). */
import { Store } from "./store"

export const SUBJ = {
  vr: { name: "Verbal Reasoning", short: "Verbal", blurb: "Vocabulary and sentence completion", color: "var(--chart-1)" },
  qr: { name: "Quantitative Reasoning", short: "Quantitative", blurb: "Reasoning with numbers, no calculator", color: "var(--chart-2)" },
  ma: { name: "Mathematics", short: "Math", blurb: "Arithmetic, geometry, data", color: "var(--chart-3)" },
  rc: { name: "Reading", short: "Reading", blurb: "Passages and comprehension", color: "var(--chart-4)" },
}
export const ORDER = ["vr", "qr", "ma", "rc"]
export const SETSIZE = 12
export const LTR = ["A", "B", "C", "D"]

export let D = null
export function setBundle(b) { D = b }

export const keyOf = (q) => q.k || q.correct

export function itemsFor(sub, wk) { return D.subjects[sub].filter((i) => i.w === wk) }
/** Split a week's items into near-equal sets of at most SETSIZE (37 -> 10/9/9/9,
 *  never 12/12/12/1). build_seed.py mirrors this so migrated results line up. */
export function chunk(all) {
  const k = Math.ceil(all.length / SETSIZE)
  if (!k) return []
  const base = Math.floor(all.length / k), extra = all.length % k
  const out = []
  for (let i = 0, at = 0; i < k; i++) { const n = base + (i < extra ? 1 : 0); out.push(all.slice(at, at + n)); at += n }
  return out
}
export function setsFor(sub, wk) { return chunk(itemsFor(sub, wk)) }
export function setId(sub, wk, n) { return `${sub}:${wk}:${n}` }
export function parseSetId(id) { const [sub, wk, n] = id.split(":"); return { sub, wk, n: +n } }
export function weekLabel(w) { const hit = D.weeks.find((x) => x.w === w); return hit ? hit.label : w }
export function currentWeek() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  let best = "W1"
  for (const w of D.weeks) if (new Date(D.starts[w.w] + "T00:00:00") <= today) best = w.w
  return best
}
export function subjProgress(sub) {
  let done = 0, total = 0, right = 0, answered = 0
  for (const w of D.weeks) {
    setsFor(sub, w.w).forEach((_, n) => {
      total++
      const r = Store.s.results[setId(sub, w.w, n)]
      if (r) { done++; right += r.right; answered += r.n }
    })
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, acc: answered ? Math.round((right / answered) * 100) : null, right, answered }
}
export function overall() {
  let done = 0, total = 0, right = 0, answered = 0
  for (const s of ORDER) { const p = subjProgress(s); done += p.done; total += p.total; right += p.right; answered += p.answered }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, acc: answered ? Math.round((right / answered) * 100) : null, right, answered }
}
/** First set not yet completed in this subject, current week first. */
export function nextSet(sub) {
  const cur = currentWeek()
  const order = [...D.weeks].sort((a, b) => (a.w === cur ? -1 : b.w === cur ? 1 : 0))
  for (const w of order) {
    const sets = setsFor(sub, w.w)
    for (let n = 0; n < sets.length; n++) if (!Store.s.results[setId(sub, w.w, n)]) return { wk: w.w, n }
  }
  return null
}
export function allWrong() {
  const seen = {}, out = []
  for (const k of Object.keys(Store.s.results)) {
    const sub = k.split(":")[0]
    for (const id of Store.s.results[k].wrong || []) {
      if (seen[id] || !D.subjects[sub]) continue
      seen[id] = 1
      const it = D.subjects[sub].find((x) => x.id === id)
      if (it) out.push({ sub, it })
    }
  }
  return out
}
export function recentSets(limit = 8) {
  return Object.keys(Store.s.results)
    .map((k) => { const p = parseSetId(k); return { id: k, sub: p.sub, wk: p.wk, set: p.n, ...Store.s.results[k] } })
    .sort((a, b) => (b.at || "").localeCompare(a.at || ""))
    .slice(0, limit)
}
/** Accuracy per subject per week, for the dashboard chart. */
export function accuracyByWeek() {
  return D.weeks.map((w) => {
    const row = { week: w.w, label: w.label }
    for (const s of ORDER) {
      let right = 0, n = 0
      setsFor(s, w.w).forEach((_, i) => { const r = Store.s.results[setId(s, w.w, i)]; if (r) { right += r.right; n += r.n } })
      row[s] = n ? Math.round((right / n) * 100) : null
    }
    return row
  })
}
export function fmtDate(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
