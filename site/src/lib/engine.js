/* Learning engine: per-question records, spaced review, error tags, pacing,
 * skill mastery, mixed sets, vocabulary mastery, mock next steps, streaks and
 * the readiness score. Pure functions over Store.s + the bundle, except the
 * few writers at the top. Nothing here ever deletes a result. */
import { D, ORDER, SUBJ, LTR, keyOf, setId, setsFor, currentWeek } from "./content"
import { Store, ts } from "./store"

/* ---------- constants ---------- */
export const CAUSES = [
  { id: "know", label: "Didn't know it", hint: "The word or the method was new or forgotten" },
  { id: "misread", label: "Misread it", hint: "Skipped a word like NOT or EXCEPT, or a unit" },
  { id: "careless", label: "Careless slip", hint: "Knew it, made a small error" },
  { id: "rushed", label: "Ran out of time", hint: "Hurried or guessed to keep moving" },
]
export const CAUSE_LABEL = Object.fromEntries(CAUSES.map((c) => [c.id, c.label]))
/** Seconds per question on the real Lower Level: 20 min/34, 35/38, 25/25, 30/30. */
export const BUDGET = { vr: 35, qr: 55, rc: 60, ma: 60 }
export const INTERVALS = [1, 3, 7, 21]                  // days: after a miss, then after each spaced correct answer
const CHECKIN_DAYS = 21, WORD_BRUSHUP_DAYS = 7
const LEARN_CTX = { set: 1, review: 1, mixed: 1, mock: 1, vocab: 1 }   // 'corr' (right after seeing the answers) is not evidence
export const LEVELS = ["Not started", "Started", "Needs work", "Familiar", "Proficient", "Mastered"]
const LEVEL_SCORE = { "Not started": 0, Started: 0.2, "Needs work": 0.35, Familiar: 0.6, Proficient: 0.85, Mastered: 1 }
const SEC2SUB = { VR: "vr", QR: "qr", RC: "rc", MA: "ma" }
const DAY = 86400000

/* ---------- small helpers ---------- */
const pad = (n) => String(n).padStart(2, "0")
export function dayKey(t) { const d = new Date(typeof t === "number" ? t : ts(t) || Date.now()); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export function plusDays(iso, n) { return new Date(ts(iso) + n * DAY).toISOString() }
export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) / 4294967296 }
function todayKey() { return dayKey(Date.now()) }
function nowIso() { return new Date().toISOString() }
export function rec(id) { return (Store.s.items || {})[id] || null }
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))

/* ---------- item index ---------- */
let IDX = null, IDX_FOR = null
function index() {
  if (IDX && IDX_FOR === D) return IDX
  IDX = {}; IDX_FOR = D
  for (const s of ORDER) for (const it of D.subjects[s] || []) IDX[it.id] = { sub: s, it, src: "set" }
  for (const form of Object.keys(D.mockItems || {})) for (const sec of Object.keys(D.mockItems[form])) for (const it of D.mockItems[form][sec]) IDX[it.id] = { sub: SEC2SUB[sec] || "vr", it, src: "mock", form }
  return IDX
}
/** Where a question id lives: its subject and the question itself (sets, mocks, or a generated word question). */
export function findItem(id) {
  if (typeof id !== "string") return null
  if (id.startsWith("w:")) { const q = wordQuestion(id.slice(2)); return q ? { sub: "vr", it: q, src: "word" } : null }
  return index()[id] || null
}

/* ---------- writers ---------- */
/** Record a batch of answers. entries: [{id, ok, ms, pick}]. ctx: set | review | mixed | mock | vocab | corr. */
export function recordAttempts(entries, ctx) {
  const now = nowIso(), map = {}
  for (const e of entries) {
    if (!e || !e.id) continue
    const prev = rec(e.id) || { hist: [] }
    const r = { ...prev, hist: [...(prev.hist || []), { at: now, ok: !!e.ok, ms: Math.round(e.ms || 0), ctx, pick: e.pick || null }].slice(-40) }
    if (LEARN_CTX[ctx]) {
      const last = (prev.hist || [])[prev.hist.length - 1]
      const sameDay = last && dayKey(last.at) === dayKey(now)
      const inPile = !!(prev.due && !prev.cleared)
      if (!e.ok) {
        r.step = 0; r.streak = 0; r.due = plusDays(now, INTERVALS[0]); r.cleared = null; r.lastMiss = now
        r.misses = (prev.misses || 0) + 1
      } else if (inPile) {
        if (!sameDay) {                                  // two answers on one day are one piece of evidence
          r.step = (prev.step || 0) + 1; r.streak = (prev.streak || 0) + 1
          if (r.step >= 2) { r.cleared = now; r.due = plusDays(now, CHECKIN_DAYS) }   // out of the pile; one check-in later
          else r.due = plusDays(now, INTERVALS[Math.min(r.step, INTERVALS.length - 1)])
        }
      } else if (prev.cleared && prev.due) {
        r.due = null; r.checkins = (prev.checkins || 0) + 1   // passed the check-in
      } else if (ctx === "vocab" && !prev.cleared) {
        r.cleared = now; r.due = plusDays(now, WORD_BRUSHUP_DAYS)   // a word answered right gets one brush-up
      }
    }
    map[e.id] = r
  }
  if (Object.keys(map).length) Store.setMany("items", map)
}
/** Cause + confidence for a miss (or clear them with nulls). */
export function setTag(id, patch) {
  const prev = rec(id) || { hist: [] }
  const next = { ...prev, ...patch }
  const hist = [...(prev.hist || [])]
  for (let i = hist.length - 1; i >= 0; i--) if (!hist[i].ok) { hist[i] = { ...hist[i], ...(patch.tag !== undefined ? { tag: patch.tag } : {}), ...(patch.sure !== undefined ? { sure: patch.sure } : {}) }; break }
  next.hist = hist
  Store.setMany("items", { [id]: next })
}
/** A precision word was rated: 1 → review tomorrow, 2 → in three days, 3 → only the quiz. */
export function scheduleWord(word, conf, when = nowIso()) {
  const id = "w:" + word, prev = rec(id) || { hist: [] }
  const r = { ...prev, explain: { at: when, conf } }
  if (conf <= 2 && !r.cleared) { r.step = 0; r.due = plusDays(when, conf === 1 ? 1 : 3) }
  Store.setMany("items", { [id]: r })
}
/** A finished mock form feeds the engine once: misses join the review pile, times feed pacing. */
export function recordMockForm(form) {
  const d = mockDone(form)
  if (!d || d.st.recorded) return false
  const entries = []
  for (const { s: def, r } of d.rows) {
    const qs = ((D.mockItems || {})[form] || {})[def.id] || []
    qs.forEach((q, i) => { const pick = (r.picks || {})[i] || null; entries.push({ id: q.id, ok: pick === keyOf(q), ms: ((r.times || {})[i]) || 0, pick }) })
  }
  recordAttempts(entries, "mock")
  Store.setSlice("mocks", form, (cur) => ({ ...cur, recorded: true }))
  return true
}
/** Create learning records for everything answered before the engine existed
 *  (migrated Sheets results, older site results, mock sections, rated words).
 *  Idempotent; never touches a record that already exists. */
export function backfill() {
  const items = Store.s.items || {}, add = {}
  const has = (id) => items[id] || add[id]
  for (const k of Object.keys(Store.s.results)) {
    const r = Store.s.results[k]
    if (!r || typeof r !== "object") continue
    const wrong = new Set(r.wrong || [])
    const ids = r.picks && Object.keys(r.picks).length ? Object.keys(r.picks) : [...wrong]
    const at = r.at || nowIso()
    for (const id of ids) {
      if (has(id)) continue
      const ok = !wrong.has(id)
      const rr = { hist: [{ at, ok, ms: 0, ctx: "set", pick: r.picks ? r.picks[id] || null : null }], at }
      if (!ok) { rr.step = 0; rr.streak = 0; rr.due = plusDays(at, 1); rr.lastMiss = at; rr.misses = 1 }
      add[id] = rr
    }
  }
  for (const form of Object.keys(Store.s.mocks || {})) {
    const d = mockDone(form)
    if (!d) continue
    for (const { s: def, r } of d.rows) {
      const qs = ((D.mockItems || {})[form] || {})[def.id] || []
      qs.forEach((q, i) => {
        if (has(q.id)) return
        const pick = (r.picks || {})[i] || null, ok = pick === keyOf(q), at = r.submittedAt
        const rr = { hist: [{ at, ok, ms: Math.round(((r.times || {})[i]) || 0), ctx: "mock", pick }], at }
        if (!ok) { rr.step = 0; rr.streak = 0; rr.due = plusDays(at, 1); rr.lastMiss = at; rr.misses = 1 }
        add[q.id] = rr
      })
    }
  }
  for (const wk of Object.keys(Store.s.precision || {})) {
    const st = Store.s.precision[wk]
    for (const w of Object.keys(st.words || {})) {
      const id = "w:" + w, e = st.words[w]
      if (has(id) || !e || !e.conf) continue
      const at = e.at || st.at || nowIso()
      const rr = { hist: [], explain: { at, conf: e.conf }, at }
      if (e.conf <= 2) { rr.step = 0; rr.due = plusDays(at, e.conf === 1 ? 1 : 3) }
      add[id] = rr
    }
  }
  if (Object.keys(add).length) Store.setMany("items", add, { stamp: false })
  return Object.keys(add).length
}

/* ---------- review queue ---------- */
/** Everything with a date on it. due: needs a go now · scheduled: later · checkin: cleared, but time to make sure it stuck. */
export function reviewQueue(sub) {
  const now = Date.now(), out = { due: [], scheduled: [], checkin: [] }
  const items = Store.s.items || {}
  for (const id of Object.keys(items)) {
    const r = items[id]
    if (!r || !r.due) continue
    const f = findItem(id)
    if (!f || (sub && f.sub !== sub)) continue
    const row = { id, sub: f.sub, it: f.it, rec: r, due: ts(r.due), src: f.src }
    if (r.cleared) { if (row.due <= now) out.checkin.push(row) }
    else if (row.due <= now) out.due.push(row)
    else out.scheduled.push(row)
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.due - b.due)
  return out
}
/** Misses in the queue broken down by cause (untagged counted separately). */
export function causeBreakdown(rows) {
  const out = { know: 0, misread: 0, careless: 0, rushed: 0, untagged: 0 }
  for (const x of rows) { const t = x.rec && x.rec.tag; if (t && out[t] != null) out[t]++; else out.untagged++ }
  return out
}
/** All misses ever (latest record state), by cause — for the dashboard. */
export function missProfile(sub) {
  const items = Store.s.items || {}, out = { know: 0, misread: 0, careless: 0, rushed: 0, untagged: 0, total: 0, sure: 0, unsure: 0 }
  for (const id of Object.keys(items)) {
    const r = items[id]
    if (!r || !r.lastMiss) continue
    if (sub) { const f = findItem(id); if (!f || f.sub !== sub) continue }
    out.total++
    if (r.tag && out[r.tag] != null) out[r.tag]++; else out.untagged++
    if (r.sure === true) out.sure++; else if (r.sure === false) out.unsure++
  }
  return out
}

/* ---------- skills & mastery ---------- */
export function skillOf(sub, it) {
  if (sub !== "vr") return it.sk || "General"
  const q = it.q || ""
  return /most nearly means/i.test(q) ? "Synonyms" : /_{3,}/.test(q) ? "Sentence completion" : "Words in context"
}
let SK_CACHE = null, SK_FOR = null
export function skillTable(sub) {
  if (!SK_CACHE || SK_FOR !== D) { SK_CACHE = {}; SK_FOR = D }
  if (SK_CACHE[sub]) return SK_CACHE[sub]
  const t = {}
  for (const it of D.subjects[sub] || []) { const sk = skillOf(sub, it); (t[sk] = t[sk] || { sk, ids: [], weeks: new Set() }); t[sk].ids.push(it.id); t[sk].weeks.add(it.w) }
  return (SK_CACHE[sub] = t)
}
function attemptsOf(r, asOf) { return (r && r.hist ? r.hist : []).filter((h) => LEARN_CTX[h.ctx] && (!asOf || ts(h.at) <= asOf)) }
/** Level of one skill, from the latest learning attempt on each of its questions.
 *  Mastered needs Proficient plus two correct answers in a mixed set or a mock on a later day. */
export function skillLevel(sub, sk, asOf) {
  const info = skillTable(sub)[sk]
  if (!info) return null
  let attempted = 0, cur = 0, overdue = 0, promoted = 0
  const now = asOf || Date.now()
  for (const id of info.ids) {
    const r = rec(id)
    const hs = attemptsOf(r, asOf)
    if (!hs.length) continue
    attempted++
    if (hs[hs.length - 1].ok) cur++
    if (r.due && !r.cleared && ts(r.due) <= now) overdue++
    const firstDay = dayKey(hs[0].at)
    if (hs.some((h) => h.ok && (h.ctx === "mixed" || h.ctx === "mock") && dayKey(h.at) !== firstDay)) promoted++
  }
  const acc = attempted ? cur / attempted : null
  let level = "Not started"
  if (attempted && attempted < 3) level = "Started"
  else if (attempted) level = acc < 0.7 ? "Needs work" : acc < 0.85 ? "Familiar" : overdue ? "Familiar" : promoted >= 2 ? "Mastered" : "Proficient"
  return { sk, level, acc, attempted, total: info.ids.length, overdue, promoted, weeks: [...info.weeks].sort(), score: LEVEL_SCORE[level] }
}
export function skillsFor(sub, asOf) {
  return Object.keys(skillTable(sub)).map((sk) => skillLevel(sub, sk, asOf)).sort((a, b) => (a.acc == null) - (b.acc == null) || (a.acc || 0) - (b.acc || 0) || b.total - a.total)
}
/** Mastery score of a subject: item-weighted level score over practiced skills. */
export function masteryOf(sub, asOf) {
  let w = 0, s = 0, mastered = 0, proficient = 0, practiced = 0
  for (const L of skillsFor(sub, asOf)) {
    if (!L.attempted) continue
    practiced++; w += L.total; s += L.total * L.score
    if (L.level === "Mastered") mastered++; else if (L.level === "Proficient") proficient++
  }
  return { score: w ? s / w : null, mastered, proficient, practiced, total: Object.keys(skillTable(sub)).length }
}

/* ---------- mixed sets ---------- */
/** An interleaved set from weeks already reached: skills sitting at Proficient (to promote) and weak
 *  skills first, nothing that is due for review, nothing seen today. Deterministic for the day. */
export function buildMixedSet(n = 12, seed = todayKey()) {
  const cur = currentWeek()
  const weeks = D.weeks.map((w) => w.w).filter((w) => w <= cur)
  const per = Math.ceil(n / ORDER.length), out = []
  for (const s of ORDER) {
    const levels = {}
    for (const sk of Object.keys(skillTable(s))) levels[sk] = skillLevel(s, sk)
    const pool = []
    for (const it of D.subjects[s] || []) {
      if (!weeks.includes(it.w)) continue
      const r = rec(it.id)
      if (r && r.due && !r.cleared) continue
      const hs = r && r.hist ? r.hist : []
      if (hs.length && dayKey(hs[hs.length - 1].at) === seed) continue
      const L = levels[skillOf(s, it)] || {}
      const prio = !hs.length ? 1 : L.level === "Proficient" ? 3 : L.level === "Needs work" || L.level === "Familiar" ? 2 : L.level === "Mastered" ? 0.5 : 1
      pool.push({ it, sub: s, prio, rnd: hash(seed + it.id) })
    }
    pool.sort((a, b) => b.prio - a.prio || a.rnd - b.rnd)
    out.push(...pool.slice(0, per))
  }
  return out.sort((a, b) => a.rnd - b.rnd).slice(0, n).map((x) => x.it)
}
export function mixedResults() {
  return Object.keys(Store.s.mixed || {}).map((k) => ({ id: k, ...Store.s.mixed[k] })).sort((a, b) => ts(b.at) - ts(a.at))
}

/* ---------- pacing ---------- */
/** Timed answers for a subject: median seconds, share inside the budget, slow-but-right and fast-but-wrong counts. */
export function pacingFor(sub, asOf) {
  const items = Store.s.items || {}, times = []
  let slowRight = 0, fastWrong = 0, within = 0
  const budget = BUDGET[sub]
  for (const id of Object.keys(items)) {
    const f = findItem(id)
    if (!f || f.sub !== sub) continue
    for (const h of items[id].hist || []) {
      if (!h.ms || !LEARN_CTX[h.ctx] || h.ctx === "vocab" || (asOf && ts(h.at) > asOf)) continue
      const sec = h.ms / 1000
      times.push(sec)
      if (sec <= budget * 1.25) within++
      if (h.ok && sec > budget * 1.5) slowRight++
      if (!h.ok && sec < budget * 0.5) fastWrong++
    }
  }
  times.sort((a, b) => a - b)
  const median = times.length ? times[Math.floor(times.length / 2)] : null
  return { n: times.length, median, budget, within: times.length ? within / times.length : null, slowRight, fastWrong }
}
export function paceFlag(sub, ms, ok) {
  if (!ms) return null
  const b = BUDGET[sub] || 50, sec = ms / 1000
  if (ok && sec > b * 1.5) return { id: "slow", label: "Slow but right", tone: "warning" }
  if (!ok && sec < b * 0.5) return { id: "fast", label: "Fast and wrong", tone: "destructive" }
  if (sec > b * 1.25) return { id: "over", label: "Over budget", tone: "outline" }
  return null
}

/* ---------- vocabulary ---------- */
let WORD_IDX = null, WORD_FOR = null
function wordIndex() {
  if (WORD_IDX && WORD_FOR === D) return WORD_IDX
  WORD_IDX = {}; WORD_FOR = D
  for (const wk of Object.keys(D.precision || {})) for (const e of D.precision[wk].words || []) if (!WORD_IDX[e.word]) WORD_IDX[e.word] = { ...e, wk }
  return WORD_IDX
}
export function wordEntry(word) { return wordIndex()[word] || null }
/** Every distinct precision word (a word repeated across weeks appears once). */
export function allWordEntries() { return Object.values(wordIndex()) }
/** "harmless, gentle, kind" / "(noun) city, funds; (adj) …" / "IMPLY = to suggest…" → one short answer phrase per sense. */
function senses(entry) {
  const m = entry.meaning || ""
  const parts = entry.word.split("/").map((x) => x.trim())
  const out = []
  if (parts.length > 1) {
    for (const w of parts) {
      // "WORD = …" or "WORD (noun) = …", up to the first sentence break
      const re = new RegExp(w.toUpperCase().replace(/[^A-Z]/g, "") + "\\s*(?:\\([^)]*\\))?\\s*=\\s*([^.;]+)")
      const hit = m.match(re)
      if (hit) out.push({ word: w, answer: shorten(hit[1]) })
    }
  }
  if (!out.length) {
    const first = m.split(";")[0]
      .replace(/^\([^)]*\)\s*/, "")                       // "(noun) city, funds"
      .replace(/^[A-Z][A-Za-z]*\s*(?:\([^)]*\))?\s*=\s*/, "")   // "PREJUDICE (noun) = an unfair opinion…"
    out.push({ word: parts[0], answer: shorten(first) })
  }
  return out.filter((x) => x.answer)
}
function shorten(s) {
  let t = (s || "").trim().replace(/\s+/g, " ")
  t = t.replace(/\s*\(.*$/, "")
  const bits = t.split(",").map((x) => x.trim()).filter(Boolean)
  if (!bits.length) return ""
  let a = bits[0]
  if (a.length < 10 && bits[1] && bits[1].length < 16) a = bits[0] + ", " + bits[1]
  if (a.length > 44) a = a.slice(0, 41).replace(/\s\S*$/, "") + "…"
  return /^[A-Z][a-z]/.test(a) ? a.charAt(0).toLowerCase() + a.slice(1) : a
}
const STOP = new Set("that this with from when what some they them then than very more most over into onto upon been being have having does doing thing things often usually sometimes especially without about because while which other another person people someone something said says make makes take takes their there like your")
/** Content stems (first four letters) of a phrase — the near-synonym test for distractors. */
function stems(str, keep) {
  const out = new Set()
  for (const w of (str || "").toLowerCase().split(/[^a-z]+/)) {
    if (w.length < 4 || (!keep && STOP.has(w))) continue
    out.add(w.slice(0, 4))
  }
  return out
}
const overlaps = (a, b) => [...a].some((x) => b.has(x))
/** A four-choice synonym question for a precision word; distractors are other words' meanings,
 *  filtered so none of them is a near-synonym of the key (whole meanings compared, not just the
 *  short phrases — "rigorous" must never be offered beside "painstaking"). */
export function wordQuestion(word, seed = todayKey()) {
  const e = wordEntry(word)
  if (!e) return null
  const ss = senses(e)
  if (!ss.length) return null
  const pick = ss[Math.floor(hash(seed + word) * ss.length)]
  const mineStrict = stems(e.word + " " + e.meaning)
  const mineLoose = stems(pick.answer + " " + e.word, true)
  const pos = (s) => (s || "").split(/[^a-z]+/i)[0].toLowerCase()
  const cands = Object.values(wordIndex()).filter((o) => o.word !== e.word).map((o) => ({ o, s: senses(o)[0] })).filter((x) => x.s && x.s.answer)
    .map((x) => ({ ...x, same: pos(x.o.pos) === pos(e.pos), rnd: hash(seed + word + x.o.word) }))
    .sort((a, b) => (b.same - a.same) || a.rnd - b.rnd)
  function collect(test, spread) {
    const seen = new Set([pick.answer]), ds = [], taken = []
    for (const x of cands) {
      if (ds.length >= 3) break
      if (seen.has(x.s.answer) || !test(x)) continue
      const st = stems(x.o.word + " " + x.o.meaning)
      if (spread && taken.some((t) => overlaps(t, st))) continue     // keep the wrong answers apart from each other too
      seen.add(x.s.answer); ds.push(x.s.answer); taken.push(st)
    }
    return ds
  }
  // strict: no shared idea anywhere in the two entries; fall back to the answer-phrase test if too few
  const notMine = (x) => !overlaps(stems(x.o.word + " " + x.o.meaning), mineStrict)
  let ds = collect(notMine, true)
  if (ds.length < 3) ds = collect(notMine, false)
  if (ds.length < 3) ds = collect((x) => !overlaps(stems(x.s.answer + " " + x.o.word, true), mineLoose), false)
  if (ds.length < 3) return null
  const choices = [pick.answer, ...ds].map((c, i) => ({ c, r: hash(seed + word + i) })).sort((a, b) => a.r - b.r)
  const k = LTR[choices.findIndex((x) => x.c === pick.answer)]
  return { id: "w:" + word, w: e.wk, sk: "Precision words", d: "M", q: `${pick.word.toUpperCase()} most nearly means:`, c: choices.map((x) => x.c), k, e: `${e.word}: ${e.meaning}${e.example ? " — " + e.example : ""}`, p: "" }
}
/** known · learning · due · new. Known = explained (rated 2–3) on one day and a synonym question right on another. */
export function wordStatus(word) {
  const r = rec("w:" + word)
  if (!r) return { status: "new" }
  const now = Date.now()
  const quiz = (r.hist || []).filter((h) => h.ctx === "vocab" || h.ctx === "review")
  const lastQuiz = quiz[quiz.length - 1]
  const explained = r.explain && r.explain.conf >= 2
  const quizRight = lastQuiz && lastQuiz.ok && quiz.some((h) => h.ok && (!r.explain || dayKey(h.at) !== dayKey(r.explain.at)))
  if (r.due && !r.cleared && ts(r.due) <= now) return { status: "due", rec: r }
  if (r.due && r.cleared && ts(r.due) <= now) return { status: "brushup", rec: r }
  if (explained && quizRight) return { status: "known", rec: r }
  return { status: "learning", rec: r, explained: !!explained, quizzed: quiz.length > 0 }
}
export function wordSummary(wk) {
  const out = { known: 0, learning: 0, due: 0, new: 0, brushup: 0, total: 0 }
  for (const e of (D.precision[wk] || { words: [] }).words) { out.total++; const s = wordStatus(e.word).status; out[s] = (out[s] || 0) + 1 }
  return out
}
export function wordQuizItems(wk, onlyDue = false) {
  const list = (D.precision[wk] || { words: [] }).words
  const rows = list.map((e) => ({ e, st: wordStatus(e.word).status })).filter((x) => !onlyDue || x.st === "due" || x.st === "brushup" || x.st === "learning" || x.st === "new")
  return rows.map((x) => wordQuestion(x.e.word)).filter(Boolean)
}

/* ---------- mocks: next steps & score band ---------- */
export const STANINE = (pct) => pct >= 92 ? 9 : pct >= 85 ? 8 : pct >= 76 ? 7 : pct >= 66 ? 6 : pct >= 55 ? 5 : pct >= 44 ? 4 : pct >= 33 ? 3 : pct >= 22 ? 2 : 1
function mockDone(form) {
  const m = D.mocks.find((x) => x.id === form), st = (Store.s.mocks || {})[form]
  if (!m || !st) return null
  const secs = m.sections.filter((s) => s.n)
  const rows = secs.map((s) => ({ s, r: (st.sections || {})[s.id] })).filter((x) => x.r && x.r.submittedAt)
  if (rows.length < secs.length) return null
  return { m, st, rows }
}
/** Estimated stanine per section and overall for every finished mock, and the band across the last three. */
export function mockBand(asOf) {
  const mocks = []
  for (const m of D.mocks) {
    const d = mockDone(m.id)
    if (!d) continue
    const at = d.st.finishedAt || d.rows[d.rows.length - 1].r.submittedAt
    if (asOf && ts(at) > asOf) continue
    const sections = {}
    let right = 0, n = 0, stSum = 0
    for (const { s, r } of d.rows) { const pct = Math.round((r.right / s.n) * 100); sections[s.id] = { pct, st: STANINE(pct), right: r.right, n: s.n, blank: s.n - Object.keys(r.picks || {}).length, timeUsed: r.timeUsed || 0, min: s.min }; right += r.right; n += s.n; stSum += STANINE(pct) }
    mocks.push({ form: m.id, name: m.name, at, pct: Math.round((right / n) * 100), st: Math.round(stSum / d.rows.length), sections })
  }
  mocks.sort((a, b) => ts(a.at) - ts(b.at))
  const recent = mocks.slice(-3)
  const lo = recent.length >= 2 ? Math.min(...recent.map((x) => x.st)) : null, hi = recent.length >= 2 ? Math.max(...recent.map((x) => x.st)) : null
  return { n: mocks.length, mocks, latest: mocks[mocks.length - 1] || null, lo, hi }
}
const baseSkill = (sk) => (sk || "").split("—")[0].trim().toLowerCase()
/** Three concrete things to do after a mock, from its misses, blanks, timing and tags. */
export function mockNextSteps(form) {
  const d = mockDone(form)
  if (!d) return []
  const steps = [], cur = currentWeek()
  const clusters = {}, causes = { know: 0, misread: 0, careless: 0, rushed: 0 }
  let untagged = 0, missTotal = 0
  for (const { s, r } of d.rows) {
    const sub = SEC2SUB[s.id]
    const qs = D.mockItems[form][s.id]
    qs.forEach((q, i) => {
      if ((r.picks || {})[i] === keyOf(q)) return
      missTotal++
      const key = sub + "|" + baseSkill(q.sk)
      clusters[key] = clusters[key] || { sub, sk: baseSkill(q.sk), n: 0 }
      clusters[key].n++
      const t = rec(q.id) && rec(q.id).tag
      if (t && causes[t] != null) causes[t]++; else untagged++
    })
    const blank = s.n - Object.keys(r.picks || {}).length
    const late = r.autoSubmitted || (r.timeUsed || 0) >= s.min * 60000 * 0.98
    if (blank >= 3 || (late && blank > 0)) steps.push({ kind: "time", text: `${s.name}: ${blank} left blank${late ? " and the clock ran out" : ""} — turn on pacing mode for this week's ${SUBJ[sub].short} sets and answer every question, guessing if needed`, path: `/s/${sub}/${cur}`, sub })
  }
  const top = Object.values(clusters).sort((a, b) => b.n - a.n).filter((c) => c.n >= 2).slice(0, 2)
  for (const c of top) {
    // the practice set with the most questions on that skill, from weeks already reached
    let best = null
    for (const w of D.weeks) { if (w.w > cur) break; setsFor(c.sub, w.w).forEach((set, n) => { const k = set.filter((q) => baseSkill(skillOf(c.sub, q)) === c.sk || baseSkill(q.sk) === c.sk).length; if (k && (!best || k > best.k)) best = { k, path: `/run/${c.sub}/${w.w}/${n}`, label: `${w.w} set ${n + 1}` } }) }
    steps.push({ kind: "skill", text: `${SUBJ[c.sub].short} · ${c.sk}: ${c.n} missed — the review pile has them now; ${best ? `redo ${best.label} (${best.k} on this skill)` : "reteach it before the next set"}`, path: best ? best.path : `/review/${c.sub}`, sub: c.sub })
  }
  const tagged = missTotal - untagged
  if (tagged >= 3) {
    const [cause, n] = Object.entries(causes).sort((a, b) => b[1] - a[1])[0]
    const advice = { know: `start the next precision quiz and read every explanation in the review pile`, misread: `underline the question's key word (NOT, EXCEPT, units) before reading the choices`, careless: `check the answer against the question once before pressing Next`, rushed: `practice with pacing mode on so the budget becomes familiar` }[cause]
    if (n >= 2) steps.push({ kind: "cause", text: `${n} of ${tagged} tagged misses were "${CAUSE_LABEL[cause]}" — ${advice}`, path: cause === "know" ? `/precision/${cur}/quiz` : "/review" })
  }
  if (untagged) steps.push({ kind: "tag", text: `Tag the ${untagged} untagged miss${untagged === 1 ? "" : "es"} below (why did it go wrong?) so these steps get sharper`, path: `/mock/${form}` })
  return steps.slice(0, 4)
}

/* ---------- activity, streaks, effort ---------- */
function eachTimestamp(fn) {
  const s = Store.s
  for (const k of Object.keys(s.results)) { const r = s.results[k]; if (r && r.at) fn(r.at, "set", r); if (r && r.first && r.first.at) fn(r.first.at, "set", r.first) }
  for (const k of Object.keys(s.mixed || {})) { const r = s.mixed[k]; if (r && r.at) fn(r.at, "mixed", r) }
  for (const id of Object.keys(s.items || {})) for (const h of (s.items[id].hist || [])) if (h.ctx === "review" || h.ctx === "vocab") fn(h.at, h.ctx, h)
  for (const wk of Object.keys(s.precision || {})) { const st = s.precision[wk]; for (const w of Object.keys(st.words || {})) { const e = st.words[w]; if (e && e.text && e.at) fn(e.at, "word", e) } }
  for (const wk of Object.keys(s.essays || {})) { const e = s.essays[wk]; if (e && e.at) fn(e.at, "essay", e); if (e && e.completedAt) fn(e.completedAt, "essay-done", e) }
  for (const f of Object.keys(s.mocks || {})) { const st = s.mocks[f]; for (const sec of Object.keys(st.sections || {})) { const r = st.sections[sec]; if (r && r.submittedAt) fn(r.submittedAt, "mock", r) } if (st.essay && st.essay.submittedAt) fn(st.essay.submittedAt, "mock-essay", st.essay) }
}
export function activityDays() { const days = new Set(); eachTimestamp((at) => { const t = ts(at); if (t) days.add(dayKey(t)) }); return days }
function weekOf(key) { const d = new Date(key + "T00:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return dayKey(d.getTime()) }
/** "Did anything today" streak; up to two missed days a week are frozen instead of breaking it. */
export function streakInfo() {
  const days = activityDays()
  const today = todayKey(), activeToday = days.has(today)
  let cursor = new Date(); cursor.setHours(0, 0, 0, 0)
  if (!activeToday) cursor.setDate(cursor.getDate() - 1)
  let current = 0, frozen = 0
  const used = {}
  for (let guard = 0; guard < 400; guard++) {
    const k = dayKey(cursor.getTime())
    if (days.has(k)) current++
    else if (current || activeToday) { const w = weekOf(k); if ((used[w] || 0) < 2) { used[w] = (used[w] || 0) + 1; frozen++ } else break }
    else break
    cursor.setDate(cursor.getDate() - 1)
  }
  // best streak ever, same freeze rule, forward from the first active day
  const sorted = [...days].sort()
  let best = 0
  if (sorted.length) {
    const start = new Date(sorted[0] + "T00:00:00"), end = new Date(today + "T00:00:00")
    let run = 0; const fz = {}
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d.getTime())
      if (days.has(k)) run++
      else { const w = weekOf(k); if (run && (fz[w] || 0) < 2) fz[w] = (fz[w] || 0) + 1; else run = 0 }
      best = Math.max(best, run)
    }
  }
  return { current, frozen, activeToday, best: Math.max(best, current), activeDays: days.size }
}
const POINTS = { set: 10, mixed: 12, review: 1, vocab: 1, word: 2, "essay-done": 15, mock: 25, "mock-essay": 15 }
/** Effort points, for attempts not accuracy. range: [fromKey, toKey] inclusive day keys. */
export function effortPoints(range) {
  let total = 0
  eachTimestamp((at, kind) => { const k = dayKey(ts(at)); if (range && (k < range[0] || k > range[1])) return; total += POINTS[kind] || 0 })
  // tagging a miss is effort too
  for (const id of Object.keys(Store.s.items || {})) { const r = Store.s.items[id]; if (r && r.tag) { const k = dayKey(ts(r.at)); if (!range || (k >= range[0] && k <= range[1])) total += 3 } }
  return total
}
export function thisWeekRange() { const w = weekOf(todayKey()); const d = new Date(w + "T00:00:00"); d.setDate(d.getDate() + 6); return [w, dayKey(d.getTime())] }

/* ---------- readiness ---------- */
const accScore = (pct) => pct == null ? null : clamp((pct - 40) / 50)
/** Recent accuracy: sets from the last three plan weeks reached, plus mock sections, weighted 2:1 recent:older. */
function recentAccuracy(sub, asOf) {
  const cur = currentWeek(), weeks = D.weeks.map((w) => w.w), ci = weeks.indexOf(cur)
  let rw = 0, rn = 0, ow = 0, on = 0
  weeks.forEach((w, i) => {
    setsFor(sub, w).forEach((_, n) => {
      const r = Store.s.results[setId(sub, w, n)]
      if (!r || (asOf && ts(r.at) > asOf)) return
      if (i >= ci - 2) { rw += r.right; rn += r.n } else { ow += r.right; on += r.n }
    })
  })
  for (const k of Object.keys(Store.s.mixed || {})) { const r = Store.s.mixed[k]; if (!r || (asOf && ts(r.at) > asOf)) continue; const bs = (r.bySub || {})[sub]; if (bs) { rw += bs.right; rn += bs.n } }
  const band = mockBand(asOf)
  for (const m of band.mocks) { const sec = m.sections[sub.toUpperCase()]; if (sec) { rw += sec.right; rn += sec.n } }
  const recent = rn ? rw / rn : null, older = on ? ow / on : null
  const pct = recent != null && older != null ? (2 * recent + older) / 3 : recent != null ? recent : older
  return { pct: pct == null ? null : Math.round(pct * 100), n: rn + on }
}
/** Per-subject score (0–100) with its parts. */
export function subjectScore(sub, asOf) {
  const acc = recentAccuracy(sub, asOf), mas = masteryOf(sub, asOf), pace = pacingFor(sub, asOf)
  const q = reviewQueue(sub)
  const pile = q.due.length + q.scheduled.length
  const parts = [
    { id: "accuracy", label: "Accuracy", weight: 50, score: accScore(acc.pct), note: acc.pct == null ? "no sets yet" : `${acc.pct}% recently` },
    { id: "mastery", label: "Mastery", weight: 25, score: mas.score, note: mas.practiced ? `${mas.mastered} mastered · ${mas.proficient} proficient of ${mas.practiced} practiced skills` : "no skills practiced yet" },
    { id: "pacing", label: "Pacing", weight: 10, score: pace.n >= 8 ? pace.within : null, note: pace.n >= 8 ? `median ${Math.round(pace.median)} s vs ${pace.budget} s budget` : "needs timed answers" },
    { id: "review", label: "Review health", weight: 15, score: asOf ? null : pile ? 1 - q.due.length / pile : 1, note: asOf ? "" : q.due.length ? `${q.due.length} overdue of ${pile}` : pile ? `${pile} scheduled, none overdue` : "pile is empty" },
  ]
  return { sub, score: combine(parts), parts, acc, mastery: mas, pacing: pace, queue: q }
}
function combine(parts) {
  let w = 0, s = 0
  for (const p of parts) if (p.score != null) { w += p.weight; s += p.weight * p.score }
  return w ? Math.round((s / w) * 100) : null
}
export const READINESS_LABEL = (score) => score == null ? "Not started" : score >= 85 ? "Test-ready" : score >= 70 ? "On track" : score >= 50 ? "Building" : "Early days"
/** Overall readiness 0–100 with a transparent breakdown. asOf (ms) recomputes it as it stood on that day. */
export function readiness(asOf) {
  const subs = {}
  for (const s of ORDER) subs[s] = subjectScore(s, asOf)
  // accuracy across subjects, weighted by questions answered
  let aw = 0, as = 0, mw = 0, ms = 0, pn = 0, pw = 0
  for (const s of ORDER) {
    const x = subs[s]
    if (x.acc.pct != null) { aw += x.acc.n; as += x.acc.n * accScore(x.acc.pct) }
    if (x.mastery.score != null) { mw += x.mastery.practiced; ms += x.mastery.practiced * x.mastery.score }
    if (x.pacing.n) { pn += x.pacing.n; pw += x.pacing.n * (x.pacing.within || 0) }
  }
  const band = mockBand(asOf)
  const q = asOf ? null : reviewQueue()
  const pile = q ? q.due.length + q.scheduled.length : 0
  const days = activityDays()
  const end = asOf ? new Date(asOf) : new Date()
  let active14 = 0
  for (let i = 0; i < 14; i++) { const d = new Date(end); d.setDate(d.getDate() - i); if (days.has(dayKey(d.getTime()))) active14++ }
  const parts = [
    { id: "accuracy", label: "Accuracy", weight: 30, score: aw ? as / aw : null, note: aw ? "recent sets, mixed sets and mock sections" : "finish a set to start" },
    { id: "mock", label: "Mock exams", weight: 20, score: band.latest ? accScore(band.latest.pct) : null, note: band.latest ? `${band.latest.name}: ${band.latest.pct}% · stanine ≈${band.latest.st}` : "no finished mock yet" },
    { id: "mastery", label: "Skill mastery", weight: 20, score: mw ? ms / mw : null, note: mw ? `${ORDER.reduce((n, s) => n + subs[s].mastery.mastered, 0)} mastered · ${ORDER.reduce((n, s) => n + subs[s].mastery.proficient, 0)} proficient` : "no skills practiced yet" },
    { id: "pacing", label: "Pacing", weight: 10, score: pn >= 8 ? pw / pn : null, note: pn >= 8 ? `${Math.round((pw / pn) * 100)}% of timed answers inside the budget` : "timed answers arrive as sets are done on the site" },
    { id: "review", label: "Review health", weight: 10, score: q ? (pile ? 1 - q.due.length / pile : 1) : null, note: q ? (q.due.length ? `${q.due.length} due now` : "nothing overdue") : "" },
    { id: "consistency", label: "Consistency", weight: 10, score: clamp(active14 / 8), note: `${active14} active days in the last 14` },
  ]
  const score = combine(parts)
  // what would move the number most: the largest weighted shortfall
  let advice = null, gap = 0
  for (const p of parts) { const g = p.weight * (1 - (p.score == null ? 0.5 : p.score)); if (g > gap) { gap = g; advice = p } }
  // an overdue pile is the one lever that works today, so it goes first once half of it is late
  const rv = parts.find((p) => p.id === "review")
  if (rv && rv.score != null && rv.score < 0.5) advice = rv
  const ADVICE = {
    accuracy: { text: "Accuracy moves the score most — do the next set slowly and read every explanation.", path: "/" },
    mock: { text: band.n ? "A stronger mock is the biggest lever now." : "Finishing the first mock will add the missing piece.", path: "/mock" },
    mastery: { text: "Promote skills: a mixed set is where Proficient becomes Mastered.", path: "/mixed" },
    pacing: { text: "Pacing is the drag — try a set with pacing mode on.", path: "/s/" + ORDER.reduce((b, s) => (subs[s].pacing.within != null && (b == null || subs[s].pacing.within < subs[b].pacing.within) ? s : b), null) },
    review: { text: q && q.due.length ? `${q.due.length} questions are due for review — clearing them lifts the score today.` : "Keep the review pile clear.", path: "/review" },
    consistency: { text: "Short sessions on more days count more than one long one.", path: "/checklist" },
  }
  return { score, label: READINESS_LABEL(score), parts, subjects: subs, band, streak: asOf ? null : streakInfo(), advice: advice ? ADVICE[advice.id] : null }
}
/** Readiness at the end of each plan week reached so far, for the trend line. */
export function readinessHistory() {
  const out = [], now = Date.now()
  for (const w of D.weeks) {
    const start = ts(D.starts[w.w] + "T00:00:00")
    if (start > now) break
    const end = Math.min(now, start + 7 * DAY - 1)
    out.push({ week: w.w, label: w.label, score: readiness(end).score })
  }
  return out
}
