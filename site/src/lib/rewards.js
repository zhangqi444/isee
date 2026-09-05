/* Badges, levels and the reward shelf. Badges are worked out from the same
 * per-question records the rest of the engine reads, then PINNED the first
 * time they are earned (Store.s.badges) so a badge can never be taken away —
 * a dip in accuracy or a growing review pile must not un-earn something. */
import { D, ORDER, setId, setsFor } from "./content"
import { Store, ts } from "./store"
import {
  activityDays, allWordEntries, effortPoints, masteryOf, mixedResults,
  mockBand, pacingFor, reviewQueue, streakInfo, wordStatus,
} from "./engine"

/* ---------- levels ---------- */
export const LEVELS = [
  { n: 1, title: "Starter", at: 0 },
  { n: 2, title: "Rookie", at: 80 },
  { n: 3, title: "Regular", at: 200 },
  { n: 4, title: "Steady", at: 360 },
  { n: 5, title: "Sharp", at: 560 },
  { n: 6, title: "Strong", at: 800 },
  { n: 7, title: "Skilled", at: 1100 },
  { n: 8, title: "Seasoned", at: 1450 },
  { n: 9, title: "Standout", at: 1850 },
  { n: 10, title: "Star", at: 2300 },
]
/** Level from lifetime effort points. Spending on rewards never costs a level. */
export function levelOf(points) {
  let i = 0
  for (let k = 0; k < LEVELS.length; k++) if (points >= LEVELS[k].at) i = k
  const cur = LEVELS[i], next = LEVELS[i + 1] || null
  const span = next ? next.at - cur.at : 1
  return { ...cur, next, into: points - cur.at, span, pct: next ? Math.min(100, Math.round(((points - cur.at) / span) * 100)) : 100 }
}

/* ---------- helpers over the records ---------- */
const results = () => Object.values(Store.s.results || {}).filter((r) => r && typeof r === "object")
const items = () => Object.values(Store.s.items || {})
function cleanSweeps() { return results().filter((r) => r.n >= 8 && r.right === r.n).length }
function retired() { return items().filter((r) => r.cleared && r.misses).length }
function knownWords() { return allWordEntries().filter((e) => wordStatus(e.word).status === "known").length }
function taggedMisses() { return items().filter((r) => r.tag).length }
function weeksSwept() {
  let n = 0
  for (const w of D.weeks) {
    let total = 0, done = 0
    for (const s of ORDER) setsFor(s, w.w).forEach((_, k) => { total++; if (Store.s.results[setId(s, w.w, k)]) done++ })
    if (total && done === total) n++
  }
  return n
}
function essaysDone() { return Object.values(Store.s.essays || {}).filter((e) => e && e.completedAt).length }
function precisionSubmitted() { return Object.values(Store.s.precision || {}).filter((p) => p && p.submittedAt).length }
function mocksDone() { return mockBand().n }
function bestMockSection() {
  let best = 0
  for (const m of mockBand().mocks) for (const s of Object.values(m.sections)) best = Math.max(best, s.pct)
  return best
}
function masteredSkills() { return ORDER.reduce((n, s) => n + masteryOf(s).mastered, 0) }
function pacingShare() {
  let n = 0, within = 0
  for (const s of ORDER) { const p = pacingFor(s); if (p.n) { n += p.n; within += p.within * p.n } }
  return { n, pct: n ? Math.round((within / n) * 100) : 0 }
}
function pileClear() { const q = reviewQueue(); return q.due.length === 0 && (q.scheduled.length > 0 || q.checkin.length > 0) }

/* ---------- badge catalogue ----------
 * `have`/`need` drive the progress bar; a badge is earned when have >= need.
 * Tiers are separate badges so an earned one is never replaced by a bigger one. */
const T = (id, name, desc, icon, group, need, get, unit) => ({ id, name, desc, icon, group, need, get, unit })
export const BADGES = [
  // Practice
  T("first-set", "First steps", "Finish your first set", "Footprints", "Practice", 1, () => results().length, "set"),
  T("sets-10", "Ten down", "Finish 10 sets", "ListChecks", "Practice", 10, () => results().length, "sets"),
  T("sets-25", "Quarter century", "Finish 25 sets", "ListChecks", "Practice", 25, () => results().length, "sets"),
  T("sets-50", "Halfway hero", "Finish 50 sets", "ListChecks", "Practice", 50, () => results().length, "sets"),
  T("sets-82", "Every last one", "Finish all 82 sets in the plan", "Trophy", "Practice", 82, () => results().length, "sets"),
  T("week-1", "Week swept", "Finish every set in one plan week", "CalendarCheck", "Practice", 1, weeksSwept, "week"),
  T("week-4", "Four weeks clean", "Sweep four plan weeks", "CalendarCheck", "Practice", 4, weeksSwept, "weeks"),
  T("week-8", "Whole plan swept", "Sweep all eight plan weeks", "CalendarCheck", "Practice", 8, weeksSwept, "weeks"),
  // Accuracy
  T("perfect-1", "Clean sweep", "Get a whole set right", "Target", "Accuracy", 1, cleanSweeps, "set"),
  T("perfect-5", "Five perfect", "Five sets with nothing missed", "Target", "Accuracy", 5, cleanSweeps, "sets"),
  T("perfect-15", "Precision machine", "Fifteen perfect sets", "Crosshair", "Accuracy", 15, cleanSweeps, "sets"),
  T("mock-section-85", "Section star", "85% or better on a mock section", "Star", "Accuracy", 85, bestMockSection, "%"),
  // Review
  T("retire-1", "Second time lucky", "Retire a question you had missed", "RotateCcw", "Review", 1, retired, "question"),
  T("retire-10", "Ten retired", "Clear ten missed questions for good", "RotateCcw", "Review", 10, retired, "questions"),
  T("retire-40", "Memory keeper", "Retire forty missed questions", "Brain", "Review", 40, retired, "questions"),
  T("pile-zero", "Pile zero", "Nothing left due in the review pile", "Sparkles", "Review", 1, () => (pileClear() ? 1 : 0), ""),
  // Words
  T("words-20", "Word collector", "Twenty words known", "BookA", "Words", 20, knownWords, "words"),
  T("words-60", "Sixty strong", "Sixty words known", "BookA", "Words", 60, knownWords, "words"),
  T("words-120", "Vocabulary vault", "A hundred and twenty words known", "Library", "Words", 120, knownWords, "words"),
  T("precision-1", "In her own words", "Submit a precision review", "PenLine", "Words", 1, precisionSubmitted, "week"),
  T("precision-8", "All eight weeks", "Submit every precision review", "PenLine", "Words", 8, precisionSubmitted, "weeks"),
  // Writing
  T("essay-1", "First draft", "Finish a weekly essay", "PenLine", "Writing", 1, essaysDone, "essay"),
  T("essay-4", "Four essays", "Finish four weekly essays", "PenLine", "Writing", 4, essaysDone, "essays"),
  T("essay-8", "Essayist", "Finish all eight weekly essays", "Feather", "Writing", 8, essaysDone, "essays"),
  // Mocks
  T("mock-1", "Dress rehearsal", "Finish a full mock exam", "Timer", "Mocks", 1, mocksDone, "mock"),
  T("mock-2", "Second run", "Finish two full mocks", "Timer", "Mocks", 2, mocksDone, "mocks"),
  T("mock-4", "Full rehearsal set", "Finish all four mocks", "Medal", "Mocks", 4, mocksDone, "mocks"),
  // Habits
  T("streak-3", "Three in a row", "Do something three days running", "Flame", "Habits", 3, () => streakInfo().best, "days"),
  T("streak-7", "A full week", "Seven days in a row", "Flame", "Habits", 7, () => streakInfo().best, "days"),
  T("streak-14", "Two weeks", "Fourteen days in a row", "Flame", "Habits", 14, () => streakInfo().best, "days"),
  T("streak-30", "A whole month", "Thirty days in a row", "Flame", "Habits", 30, () => streakInfo().best, "days"),
  T("active-30", "Thirty days in", "Thirty days with practice on them", "CalendarDays", "Habits", 30, () => activityDays().size, "days"),
  T("tag-10", "Detective", "Say why ten misses went wrong", "Search", "Habits", 10, taggedMisses, "tagged"),
  T("tag-40", "Chief detective", "Tag forty misses", "Search", "Habits", 40, taggedMisses, "tagged"),
  T("mixed-1", "Shuffled", "Finish a mixed set", "Shuffle", "Habits", 1, () => mixedResults().length, "set"),
  T("mixed-6", "Interleaver", "Finish six mixed sets", "Shuffle", "Habits", 6, () => mixedResults().length, "sets"),
  T("mastery-1", "First mastery", "Take a skill all the way to Mastered", "Award", "Habits", 1, masteredSkills, "skill"),
  T("mastery-5", "Five mastered", "Five skills at Mastered", "Award", "Habits", 5, masteredSkills, "skills"),
  T("mastery-15", "Fifteen mastered", "Fifteen skills at Mastered", "Crown", "Habits", 15, masteredSkills, "skills"),
  T("pace-80", "On the clock", "Keep 80% of 30+ timed answers inside the budget", "Gauge", "Habits", 80, () => { const p = pacingShare(); return p.n >= 30 ? p.pct : 0 }, "%"),
]
export const BADGE_GROUPS = ["Practice", "Accuracy", "Review", "Words", "Writing", "Mocks", "Habits"]
const BY_ID = Object.fromEntries(BADGES.map((b) => [b.id, b]))

/** Live state of every badge: earned (with the date it was pinned) and progress toward the rest. */
export function badgeState() {
  const earned = Store.s.badges || {}
  return BADGES.map((b) => {
    let have = 0
    try { have = b.get() || 0 } catch { have = 0 }
    const pinned = earned[b.id]
    return { ...b, have, done: !!pinned || have >= b.need, at: pinned ? pinned.at : null, pct: Math.min(100, Math.round((have / b.need) * 100)) }
  })
}
/** Pin anything newly earned. Returns the badges earned by this call (for the "just earned" row). */
export function syncBadges() {
  const earned = Store.s.badges || {}, add = {}
  for (const b of badgeState()) if (!earned[b.id] && b.have >= b.need) add[b.id] = { at: new Date().toISOString(), have: b.have }
  const ids = Object.keys(add)
  if (ids.length) Store.setMany("badges", add)
  return ids.map((id) => BY_ID[id])
}
export function recentBadges(days = 3) {
  const cut = Date.now() - days * 86400000
  return badgeState().filter((b) => b.at && ts(b.at) >= cut).sort((a, b) => ts(b.at) - ts(a.at))
}

/* ---------- the reward shelf ----------
 * Slice `rewards`, one key per row: "item:<id>" is a reward Qi put on the shelf,
 * "claim:<id>" is Sheila claiming one. Points are spent at claim time; a claim
 * can be cancelled, which puts them back. */
export const SUGGESTED = [
  { name: "Pick Friday's movie", cost: 150 },
  { name: "Boba on the way home", cost: 200 },
  { name: "Choose Saturday's dinner", cost: 250 },
  { name: "An extra hour of screen time", cost: 300 },
  { name: "A new book she picks herself", cost: 500 },
  { name: "A day out — her choice where", cost: 900 },
]
const rows = () => Store.s.rewards || {}
export function shelf() {
  return Object.keys(rows()).filter((k) => k.startsWith("item:") && !rows()[k].removed)
    .map((k) => ({ id: k.slice(5), key: k, ...rows()[k] }))
    .sort((a, b) => a.cost - b.cost)
}
export function claims() {
  return Object.keys(rows()).filter((k) => k.startsWith("claim:"))
    .map((k) => ({ id: k.slice(6), key: k, ...rows()[k] }))
    .filter((c) => c.status !== "cancelled")
    .sort((a, b) => ts(b.at) - ts(a.at))
}
export function spent() { return claims().reduce((n, c) => n + (c.cost || 0), 0) }
/** Lifetime points fix the level; the balance is what is left after claims. */
export function wallet() {
  const lifetime = effortPoints()
  const used = spent()
  return { lifetime, spent: used, balance: Math.max(0, lifetime - used), level: levelOf(lifetime) }
}
const newId = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)
export function addReward(name, cost) {
  const id = newId()
  Store.setSlice("rewards", "item:" + id, () => ({ name: String(name).slice(0, 80), cost: Math.max(10, Math.round(cost) || 100) }))
  return id
}
export function updateReward(id, patch) { Store.setSlice("rewards", "item:" + id, (cur) => ({ ...cur, ...patch })) }
export function removeReward(id) { Store.setSlice("rewards", "item:" + id, (cur) => ({ ...cur, removed: true })) }
export function claimReward(item) {
  if (wallet().balance < item.cost) return null
  const id = newId()
  Store.setSlice("rewards", "claim:" + id, () => ({ rewardId: item.id, name: item.name, cost: item.cost, status: "claimed" }))
  return id
}
export function markGiven(id) { Store.setSlice("rewards", "claim:" + id, (cur) => ({ ...cur, status: "given", givenAt: new Date().toISOString() })) }
export function cancelClaim(id) { Store.setSlice("rewards", "claim:" + id, (cur) => ({ ...cur, status: "cancelled" })) }

/** What is closest to being earned — for the dashboard nudge. */
export function nextBadge() {
  const open = badgeState().filter((b) => !b.done && b.have > 0)
  open.sort((a, b) => b.pct - a.pct || a.need - b.need)
  return open[0] || badgeState().find((b) => !b.done) || null
}
export function badgeCounts() { const all = badgeState(); return { earned: all.filter((b) => b.done).length, total: all.length } }
