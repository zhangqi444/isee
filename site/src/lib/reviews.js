/* Essay reviews: feedback on one of her essays, written outside the app (by Claude,
 * asked by a parent) and carried into her progress.json so every device shows it.
 *
 * Why it goes through the app and not straight into Drive: the site only holds
 * the drive.file scope, so it can only see files it created itself. A review has
 * to enter through the app — pasted or opened as an import link — and from there
 * it syncs like everything else. The contract is docs/essay-review.md. */
import { D } from "@/lib/content"
import { Store, ts } from "@/lib/store"

export const REVIEW_VERSION = 1
const LIST = ["strengths", "suggestions"]

function str(v) { return typeof v === "string" ? v.trim() : "" }
function list(v) { return Array.isArray(v) ? v.map(str).filter(Boolean) : [] }

/** Normalise one review from the outside world. Returns null when it cannot be one. */
export function normalizeReview(raw) {
  if (!raw || typeof raw !== "object") return null
  const t = raw.target || {}
  let target = null
  if (t.kind === "essay" && D.essay && D.essay.weeks[t.wk]) target = { kind: "essay", wk: t.wk }
  if (t.kind === "mock" && D.mocks.some((m) => m.id === t.form)) target = { kind: "mock", form: t.form }
  if (!target) return null
  const summary = str(raw.summary)
  if (!summary) return null
  const at = ts(raw.at) ? new Date(ts(raw.at)).toISOString() : new Date().toISOString()
  const key = target.kind === "essay" ? target.wk : target.form
  const id = str(raw.id) || `${target.kind}:${key}:${at.slice(0, 10)}`
  const out = { id, v: REVIEW_VERSION, target, at, reviewer: str(raw.reviewer) || "Reviewer", summary, next: str(raw.next) }
  for (const k of LIST) out[k] = list(raw[k])
  if (str(raw.source)) out.source = str(raw.source)     // where the reviewer read it, e.g. "the Essay workbook"
  if (raw.draftAt && ts(raw.draftAt)) out.draftAt = new Date(ts(raw.draftAt)).toISOString()
  if (typeof raw.words === "number" && raw.words >= 0) out.words = Math.round(raw.words)
  const dims = ((D.essay && D.essay.rubric && D.essay.rubric.dimensions) || []).map((d) => d.name)
  const rubric = {}
  for (const k of Object.keys(raw.rubric || {})) { const n = Math.round(+raw.rubric[k]); if (dims.includes(k) && n >= 1 && n <= 4) rubric[k] = n }
  if (Object.keys(rubric).length) out.rubric = rubric
  return out
}

/** A payload is either one review, an array of them, or {reviews: {id: review}}. */
export function reviewsFromPayload(obj) {
  const raws = Array.isArray(obj) ? obj : obj && obj.reviews && typeof obj.reviews === "object" ? Object.values(obj.reviews) : [obj]
  const out = {}
  for (const r of raws) { const n = normalizeReview(r); if (n) out[n.id] = n }
  return out
}

/* base64url ⇄ UTF-8 JSON, so a review fits in a link: #/import/<payload> */
export function encodePayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
export function decodePayload(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return JSON.parse(new TextDecoder().decode(bytes))
}
/** Accepts pasted JSON or a pasted import link / payload. Throws with a plain message. */
export function parseImport(text) {
  const t = (text || "").trim()
  if (!t) throw new Error("Nothing to import yet.")
  let obj
  if (t.startsWith("{") || t.startsWith("[")) obj = JSON.parse(t)
  else {
    const m = t.match(/(?:#\/import\/)?([A-Za-z0-9_-]{16,})\s*$/)
    if (!m) throw new Error("That does not look like a review link or review JSON.")
    obj = decodePayload(m[1])
  }
  const map = reviewsFromPayload(obj)
  if (!Object.keys(map).length) throw new Error("No review found in it. A review needs a target (essay week or mock form) and a summary.")
  return map
}

/* ---------- reading ---------- */
export function allReviews() { return Object.values(Store.s.reviews || {}).filter((r) => r && r.target).sort((a, b) => ts(b.at) - ts(a.at)) }
export function reviewsFor(target) {
  return allReviews().filter((r) => r.target.kind === target.kind && (target.kind === "essay" ? r.target.wk === target.wk : r.target.form === target.form))
}
export function isSeen(id) { return !!(Store.s.reviewsSeen || {})[id] }
export function unseenReviews() { return allReviews().filter((r) => !isSeen(r.id)) }
export function markSeen(id) {
  if (isSeen(id)) return
  Store.setMany("reviewsSeen", { [id]: { at: new Date().toISOString() } })
}
/** Store reviews that arrived by link or paste. Existing ids are kept unless the new copy is newer. */
export function addReviews(map) {
  const cur = Store.s.reviews || {}, add = {}
  for (const id of Object.keys(map)) { if (!cur[id] || ts(map[id].at) > ts(cur[id].at)) add[id] = map[id] }
  if (Object.keys(add).length) Store.setMany("reviews", add, { stamp: false })
  return Object.keys(add).length
}
export function reviewTargetLabel(r) {
  if (r.target.kind === "essay") return `Essay · ${r.target.wk}`
  const m = D.mocks.find((x) => x.id === r.target.form)
  return `${m ? m.name : r.target.form} · essay`
}
export function reviewPath(r) { return r.target.kind === "essay" ? `/essay/${r.target.wk}` : `/mock/${r.target.form}/ESSAY` }
