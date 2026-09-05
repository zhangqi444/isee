/* The reading log. Independent reading is the biggest long-run lever on the
 * Reading and Verbal sections, so it is tracked like everything else: sessions
 * feed the streak and effort points, finished books earn badges. */
import { D } from "./content"
import { Store, ts } from "./store"

const rows = () => Store.s.books || {}
const newId = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)
const today = () => new Date().toISOString().slice(0, 10)

/** One-time: put the books she has actually read on the shelf. Never overwrites. */
export function seedBooks() {
  if (Store.s.booksSeeded || !D.books) return 0
  const add = {}
  for (const b of D.books.starter || []) if (!rows()[b.id]) add[b.id] = { ...b, sessions: [], words: [], seeded: true }
  if (Object.keys(add).length) Store.setMany("books", add)
  Store.setPref("booksSeeded", true)
  return Object.keys(add).length
}

export function books() {
  return Object.keys(rows()).map((id) => ({ id, ...rows()[id] })).filter((b) => !b.removed)
}
const ORDER = { reading: 0, want: 1, finished: 2 }
export function shelf() {
  return books().sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3) || ts(b.finishedAt || b.at) - ts(a.finishedAt || a.at))
}
export function currentBook() { return books().find((b) => b.status === "reading") || null }
export function finishedBooks() { return books().filter((b) => b.status === "finished") }
export function readingDays() {
  const days = new Set()
  for (const b of books()) for (const s of b.sessions || []) if (s.on) days.add(s.on)
  return days
}
export function wordsCollected() { return books().reduce((n, b) => n + (b.words || []).length, 0) }
/** Pages read, when she has told us both numbers. */
export function progressOf(b) {
  if (!b.pages || !b.page) return null
  return Math.max(0, Math.min(100, Math.round((b.page / b.pages) * 100)))
}
export function readThisWeek(range) {
  let n = 0
  for (const d of readingDays()) if (d >= range[0] && d <= range[1]) n++
  return n
}
export function readToday() { return readingDays().has(today()) }

/* ---------- writers ---------- */
const write = (id, fn) => Store.setSlice("books", id, (cur) => fn({ sessions: [], words: [], ...cur }))
export function addBook({ title, author, pages, status = "want" }) {
  const t = String(title || "").trim()
  if (!t) return null
  const id = newId()
  write(id, (cur) => ({ ...cur, title: t.slice(0, 120), author: String(author || "").trim().slice(0, 80), pages: pages ? Math.max(1, +pages) : null, status }))
  return id
}
export function startBook(id) { write(id, (cur) => ({ ...cur, status: "reading", startedAt: cur.startedAt || new Date().toISOString() })) }
export function finishBook(id) { write(id, (cur) => ({ ...cur, status: "finished", finishedAt: new Date().toISOString(), page: cur.pages || cur.page })) }
export function reopenBook(id) { write(id, (cur) => ({ ...cur, status: "reading", finishedAt: null })) }
export function removeBook(id) { write(id, (cur) => ({ ...cur, removed: true })) }
export function setPages(id, pages, page) {
  write(id, (cur) => ({ ...cur, pages: pages == null ? cur.pages : (pages ? Math.max(1, +pages) : null), page: page == null ? cur.page : (page === "" ? null : Math.max(0, +page)) }))
}
export function rateBook(id, stars) { write(id, (cur) => ({ ...cur, rating: cur.rating === stars ? null : stars })) }
/** "I read today" — optionally with where she got to. One session per day per book. */
export function logSession(id, { page, minutes } = {}) {
  const on = today()
  write(id, (cur) => {
    const sessions = (cur.sessions || []).filter((s) => s.on !== on)
    sessions.push({ on, at: new Date().toISOString(), page: page ? +page : null, minutes: minutes ? +minutes : null })
    return { ...cur, sessions: sessions.slice(-400), status: cur.status === "finished" ? cur.status : "reading", startedAt: cur.startedAt || new Date().toISOString(), page: page ? +page : cur.page }
  })
}
export function undoSession(id, on) {
  write(id, (cur) => ({ ...cur, sessions: (cur.sessions || []).filter((s) => s.on !== on) }))
}
export function addWord(id, word) {
  const w = String(word || "").trim()
  if (!w) return
  write(id, (cur) => ({ ...cur, words: [...(cur.words || []).filter((x) => x.w.toLowerCase() !== w.toLowerCase()), { w: w.slice(0, 40), at: new Date().toISOString() }] }))
}
export function removeWord(id, word) { write(id, (cur) => ({ ...cur, words: (cur.words || []).filter((x) => x.w !== word) })) }
export const suggestions = () => (D.books && D.books.suggestions) || []
