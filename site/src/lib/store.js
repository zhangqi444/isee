/* Persistence: localStorage first, mirrored to a JSON file in the user's own
 * Google Drive once they authorize the site (scope: drive.file — the app can
 * only see files it created, inside the folder it created). */
import { useSyncExternalStore } from "react"

const KEY = "isee.v1"
const FOLDER = "Sheila ISEE Practice"
const FILE = "progress.json"
const CLIENT_ID = (typeof window !== "undefined" && window.__OAUTH_CLIENT_ID__) || ""
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const SCOPE = DRIVE_SCOPE + " openid email profile"
export const DRIVE_ENABLED = typeof window !== "undefined" && !!window.__ENABLE_DRIVE__

function lsLoad() { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
function lsSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode etc. */ } }

/** Timestamp of an `at` value that may be an ISO string, a number, or missing. */
export function ts(v) { if (typeof v === "number") return v; const n = Date.parse(v || ""); return isNaN(n) ? 0 : n }

const listeners = new Set()
let version = 0
function emit() { version++; listeners.forEach((f) => f()) }

export const Store = {
  s: null,
  token: null, tokenExp: 0, folderId: null, fileId: null, pushTimer: null, tc: null,
  waiter: null, pending: null, name: null, picture: null,
  dirty: false, flushing: false, reconnectNeeded: false, reconnectDismissed: false,
  status: "local",          // local | connecting | syncing | live | expired | error | unavailable
  email: null,
  lastSync: null,

  init() {
    this.s = lsLoad()
    this.s.results = this.s.results || {}
    for (const k of ["precision", "essays", "mocks", "checklists", "items", "mixed", "badges", "rewards", "books", "reviews", "reviewsSeen"]) if (!this.s[k] || typeof this.s[k] !== "object") this.s[k] = {}
    // The first (vanilla) site stored `at` as Date.now(); everything since uses ISO strings.
    for (const k of Object.keys(this.s.results)) {
      const r = this.s.results[k]
      if (!r || typeof r !== "object") { delete this.s.results[k]; continue }
      if (typeof r.at === "number") r.at = new Date(r.at).toISOString()
      else if (r.at != null && typeof r.at !== "string") r.at = ""
      if (!Array.isArray(r.wrong)) r.wrong = []
    }
    // Resume a Drive session that is still inside its one-hour token window.
    const d = this.s.drive
    if (d && d.token) { this.token = d.token; this.tokenExp = d.exp || 0; this.email = d.email || null; this.name = d.name || null; this.picture = d.picture || null }
    else if (this.s.driveOptIn && DRIVE_ENABLED) this.status = "expired"
    return this.s
  },
  /** Called once at boot. A live token resumes straight away; a stale one is
   *  refreshed silently, the way zhangqi444/volunteer does it, so an overnight
   *  gap does not greet her with a sign-in prompt. If even that needs a click,
   *  we fall back to the Reconnect chip and say nothing until a save fails. */
  resume() {
    if (!DRIVE_ENABLED || !this.s.driveGranted) return
    if (this.valid()) return this.afterAuth()
    this.ensureToken().then(() => this.afterAuth()).catch(() => this.setStatus("expired"))
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  snapshot() { return version },
  setStatus(v) { this.status = v; emit() },

  /* One-time migration of results Sheila entered in the Google Sheets. */
  applySeed(seed) {
    if (!seed || !seed.results) return 0
    if ((this.s.seedApplied || 0) >= seed.version) return 0
    let added = 0
    const prev = this.s.seedApplied || 0
    for (const k of Object.keys(seed.results)) {
      const cur = this.s.results[k], inc = seed.results[k]
      // Add what is missing; when the seed itself was revised, also replace an
      // entry that is still the untouched migrated one (same timestamp), never
      // a set she has since redone on the site.
      if (!cur || (prev && cur.at === inc.at)) { this.s.results[k] = inc; added++ }
    }
    // Drop migrated entries the revised seed no longer has (set count changed).
    if (prev) for (const k of Object.keys(this.s.results)) {
      const r = this.s.results[k]
      if (!seed.results[k] && seed.migrated_at && r.at === seed.migrated_at) delete this.s.results[k]
    }
    if (seed.precision) for (const wk of Object.keys(seed.precision)) {
      const cur = this.s.precision[wk], inc = seed.precision[wk]
      if (!cur || !Object.keys(cur.words || {}).length || cur.at === inc.at) { this.s.precision[wk] = JSON.parse(JSON.stringify(inc)); added++ }
    }
    this.s.seedApplied = seed.version
    lsSave(this.s)
    return added
  },
  /* Generic per-slice writers: precision[wk], essays[wk], mocks[form]; all stamp `at` and sync. */
  setSlice(slice, key, fn) {
    const cur = this.s[slice][key] || {}
    const next = fn(cur) || cur
    next.at = new Date().toISOString()
    this.s[slice][key] = next
    lsSave(this.s); emit(); this.schedulePush()
  },
  /** Write several keys of a slice at once (one save, one sync). `stamp:false` keeps
   *  the records' own `at` — used by the backfill so older migrated records never
   *  outrank a copy another device has since enriched. */
  setMany(slice, map, { stamp = true } = {}) {
    if (!this.s[slice]) this.s[slice] = {}
    const now = new Date().toISOString()
    for (const k of Object.keys(map)) { const v = map[k]; if (stamp || !v.at) v.at = now; this.s[slice][k] = v }
    lsSave(this.s); emit(); this.schedulePush()
  },
  setPref(k, v) { this.s[k] = v; lsSave(this.s); emit(); this.schedulePush() },
  recordSet(setId, res) {
    this.s.results[setId] = res
    lsSave(this.s); emit(); this.schedulePush()
  },
  clearWrong(fn) {          // fn(setId, result) -> new wrong[]
    for (const k of Object.keys(this.s.results)) {
      const r = this.s.results[k]
      r.wrong = fn(k, r)
    }
    lsSave(this.s); emit(); this.schedulePush()
  },
  setTheme(t) { this.s.theme = t; lsSave(this.s); emit() },
  dark: false,
  setDark(d) { if (this.dark !== d) { this.dark = d; emit() } },
  setDriveOptIn(v) { this.s.driveOptIn = v; lsSave(this.s) },

  /* ---- Google Drive ----
   * Auth follows the pattern in zhangqi444/volunteer (js/drive.js): one token
   * client, a waiter promise per request, and a SILENT refresh before any call
   * whose token has gone stale — so the one-hour expiry never reaches the user.
   * The interactive grant still needs a click; browsers block popups without one. */
  client() {
    if (this.tc) return this.tc
    if (!DRIVE_ENABLED || !window.google || !google.accounts || !google.accounts.oauth2) return null
    this.tc = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        const w = this.waiter; this.waiter = null
        if (!resp || !resp.access_token) {
          const msg = resp && resp.error ? `Google said: ${resp.error_description || resp.error}` : "Sign-in was cancelled."
          this.lastError = msg
          return w ? w.reject(new Error(msg)) : null
        }
        // A user can untick the Drive permission on the consent screen; catch it here
        // rather than failing later with a confusing 403.
        if (google.accounts.oauth2.hasGrantedAllScopes && !google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) {
          this.lastError = "Google Drive access was not granted, so nothing can be saved there."
          return w ? w.reject(new Error(this.lastError)) : null
        }
        this.token = resp.access_token
        this.tokenExp = Date.now() + (resp.expires_in || 3600) * 1000 - 60000
        this.s.driveGranted = true
        this.saveSession()
        if (w) w.resolve(this.token)
      },
      error_callback: (err) => {
        const w = this.waiter; this.waiter = null
        console.warn("oauth", err)
        this.lastError = err && err.type === "popup_failed_to_open"
          ? "Your browser blocked the sign-in window. Allow pop-ups for this site and try again."
          : err && err.type === "popup_closed" ? "The sign-in window was closed before finishing."
          : (err && (err.message || err.type)) || "Sign-in failed."
        if (w) w.reject(new Error(this.lastError))
      },
    })
    return this.tc
  },
  /** One in-flight token request at a time. `prompt` is "" for a silent refresh. */
  requestToken(prompt) {
    const tc = this.client()
    if (!tc) { this.setStatus("unavailable"); return Promise.reject(new Error("Google Sign-In is not available here.")) }
    if (this.waiter) return this.pending
    this.pending = new Promise((resolve, reject) => { this.waiter = { resolve, reject } })
    const req = {}
    if (prompt !== undefined) req.prompt = prompt
    if (this.email) req.hint = this.email
    try { tc.requestAccessToken(req) } catch (e) { this.waiter = null; return Promise.reject(e) }
    return this.pending
  },
  /** A usable token, refreshed silently when it has aged out. */
  ensureToken() {
    if (this.valid()) return Promise.resolve(this.token)
    if (!this.s.driveGranted) return Promise.reject(new Error("Not connected to Google Drive."))
    this.token = null
    return this.requestToken("").catch((e) => {
      // Silent refresh needs a real click sometimes (session gone, popup blocked).
      this.setStatus("expired")
      throw e
    })
  },
  /** Interactive sign-in. Must be called from a click. */
  signIn() {
    this.setDriveOptIn(true)
    this.setStatus("connecting")
    this.reconnectNeeded = false
    return this.requestToken(this.s.driveGranted ? "" : "consent")
      .then(() => this.afterAuth())
      .catch((e) => {
        this.setStatus(this.s.driveGranted ? "expired" : "local")
        throw e
      })
  },
  saveSession() {
    this.s.drive = { token: this.token, exp: this.tokenExp, email: this.email, name: this.name, picture: this.picture }
    lsSave(this.s)
  },
  signOut() {
    const t = this.token
    this.token = null; this.tokenExp = 0; this.folderId = null; this.fileId = null
    this.email = null; this.name = null; this.picture = null
    delete this.s.drive; delete this.s.driveGranted
    this.setDriveOptIn(false); this.setStatus("local")
    if (t && window.google && google.accounts && google.accounts.oauth2) { try { google.accounts.oauth2.revoke(t) } catch { /* ignore */ } }
  },
  /** She chose "not now" on the welcome dialog; do not ask again unprompted. */
  dismissSignIn() { this.setPref("signInAsked", true) },
  valid() { return this.token && Date.now() < this.tokenExp },
  /** Every Drive call goes through here: fresh token first, one retry on a 401. */
  api(url, opts = {}, retry = true) {
    return this.ensureToken().then((tok) =>
      fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + tok } }).then((r) => {
        if (r.status === 401 && retry) { this.token = null; this.tokenExp = 0; return this.api(url, opts, false) }
        if (!r.ok) throw new Error("Drive " + r.status + " " + url.split("?")[0])
        return r
      })
    )
  },
  afterAuth() {
    this.setStatus("syncing")
    if (!this.s.driveOptIn) this.setDriveOptIn(true)
    // returned, so signIn() resolves only once the first sync is actually done
    return this.api("https://www.googleapis.com/oauth2/v3/userinfo").then((r) => r.json())
      .then((u) => { if (u) { this.email = u.email || null; this.name = u.name || null; this.picture = u.picture || null } this.saveSession() }).catch(() => {})
      .then(() => this.ensureFolder())
      .then(() => this.pull())
      .then(() => { this.lastSync = new Date(); this.setStatus("live") })
      .catch((e) => {
        console.warn("drive sync failed", e)
        this.lastError = String(e.message || e)
        if (/Drive 401/.test(this.lastError)) { this.token = null; this.tokenExp = 0; delete this.s.drive; lsSave(this.s); this.setStatus("expired") }
        else this.setStatus("error")
      })
  },
  ensureFolder() {
    const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER}' and trashed=false`)
    return this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`)
      .then((r) => r.json())
      .then((d) => {
        if (d.files && d.files.length) { this.folderId = d.files[0].id; return }
        return this.api("https://www.googleapis.com/drive/v3/files", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }),
        }).then((r) => r.json()).then((f) => { this.folderId = f.id })
      })
  },
  findFile() {
    const q = encodeURIComponent(`name='${FILE}' and '${this.folderId}' in parents and trashed=false`)
    return this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`)
      .then((r) => r.json())
      .then((d) => { this.fileId = d.files && d.files[0] ? d.files[0].id : null; return this.fileId })
  },
  /** Read the remote copy, merge it in, write the union back. Every save goes through
   *  here (not straight to push), so a review someone added to progress.json from
   *  outside, or work another device saved meanwhile, is never overwritten. */
  pull() {
    const found = this.fileId ? Promise.resolve(this.fileId) : this.findFile()
    return found.then((id) => {
      if (!id) return this.push()                       // nothing remote yet -> seed it from local
      return this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
        .then((r) => r.json())
        .then((remote) => { this.merge(remote); return this.push() })
    })
  },
  merge(remote) {
    if (!remote || !remote.results) return
    // keyed slices: last-write-wins per key by `at`. `reviews` are written outside the
    // app (see lib/reviews.js), so a remote copy this device has never seen must land.
    for (const slice of ["precision", "essays", "mocks", "checklists", "mixed", "badges", "rewards", "books", "reviews", "reviewsSeen"]) {
      const rs = remote[slice] || {}, ls = this.s[slice]
      for (const k of Object.keys(rs)) {
        if (!rs[k] || typeof rs[k] !== "object") continue
        if (!ls[k] || ts(rs[k].at) > ts(ls[k].at)) ls[k] = rs[k]
      }
    }
    // learning records: newer copy wins the schedule/tags, attempt history is the union
    {
      const rs = remote.items || {}, ls = this.s.items
      for (const k of Object.keys(rs)) {
        const rr = rs[k], lr = ls[k]
        if (!rr || typeof rr !== "object") continue
        if (!lr) { ls[k] = rr; continue }
        const newer = ts(rr.at) > ts(lr.at) ? rr : lr
        const seen = {}, hist = []
        for (const h of [...(lr.hist || []), ...(rr.hist || [])]) { const key = (h.at || "") + "|" + (h.ctx || ""); if (h && !seen[key]) { seen[key] = 1; hist.push(h) } }
        hist.sort((a, b) => ts(a.at) - ts(b.at))
        ls[k] = { ...newer, hist: hist.slice(-40) }
      }
    }
    if (remote.testDate && !this.s.testDate) { this.s.testDate = remote.testDate; this.s.testFormat = remote.testFormat || this.s.testFormat }
    if (remote.pacing && this.s.pacing == null) this.s.pacing = true
    if (remote.booksSeeded) this.s.booksSeeded = true
    const local = this.s.results
    for (const k of Object.keys(remote.results)) {
      const rr = remote.results[k], lr = local[k]
      if (!rr || typeof rr !== "object") continue
      if (typeof rr.at === "number") rr.at = new Date(rr.at).toISOString()
      if (!Array.isArray(rr.wrong)) rr.wrong = []
      const lt = lr ? ts(lr.at) : -1, rt = ts(rr.at)
      if (!lr || rt > lt) local[k] = rr                    // last-write-wins by timestamp
      else if (rt === lt) local[k] = { ...rr, ...lr, picks: lr.picks || rr.picks }   // same attempt: keep the richer copy
    }
    lsSave(this.s); emit()
    if (this.afterMerge) this.afterMerge()
  },
  schedulePush() {
    if (!DRIVE_ENABLED || !this.s.driveGranted) return
    this.dirty = true
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => this.flush(), 1200)
  },
  /** Write the pending state out. Keeps `dirty` set if it fails, so a later
   *  save, coming back online, or closing the tab tries again. */
  flush() {
    clearTimeout(this.pushTimer)
    if (!this.dirty || this.flushing) return Promise.resolve()
    this.flushing = true
    this.setStatus("syncing")
    // No folder yet means the session lapsed before it was set up: take the whole
    // path (token, folder, pull, push) so a save can still land.
    const run = this.folderId ? this.pull() : this.ensureToken().then(() => this.ensureFolder()).then(() => this.pull())
    return run
      .then(() => { this.dirty = false; this.lastSync = new Date(); this.setStatus("live") })
      .catch((e) => {
        this.lastError = String(e.message || e)
        const auth = /Not connected|sign-in|popup|Drive 401/i.test(this.lastError)
        // Only now is it worth interrupting her: a save actually could not happen.
        if (auth) this.reconnectNeeded = true
        this.setStatus(auth ? "expired" : "error")
      })
      .finally(() => { this.flushing = false })
  },
  /** The Drive payload. Schema 5: bump it, and update init/merge/push, when a slice is added. */
  body() {
    return JSON.stringify({ schema: 5, savedAt: new Date().toISOString(), results: this.s.results,
      precision: this.s.precision, essays: this.s.essays, mocks: this.s.mocks, checklists: this.s.checklists, items: this.s.items, mixed: this.s.mixed,
      badges: this.s.badges, rewards: this.s.rewards, books: this.s.books, booksSeeded: !!this.s.booksSeeded,
      reviews: this.s.reviews, reviewsSeen: this.s.reviewsSeen,
      testDate: this.s.testDate || null, testFormat: this.s.testFormat || null, pacing: !!this.s.pacing })
  },
  push() {
    if (!this.folderId) return Promise.resolve()
    const body = this.body()
    if (this.fileId) {
      return this.api(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
    }
    const meta = { name: FILE, mimeType: "application/json", parents: [this.folderId] }
    const boundary = "iseebnd" + Date.now()
    const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`
    return this.api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart })
      .then((r) => r.json()).then((f) => { this.fileId = f.id })
  },
}

if (typeof window !== "undefined") {
  // Come back online with something unsaved: try again.
  addEventListener("online", () => { if (Store.dirty) Store.flush() })
  // Closing the tab inside the debounce window used to lose the last answer.
  addEventListener("pagehide", () => {
    if (!Store.dirty || !Store.fileId || !Store.valid()) return
    try {
      fetch(`https://www.googleapis.com/upload/drive/v3/files/${Store.fileId}?uploadType=media`, {
        method: "PATCH", keepalive: true,
        headers: { Authorization: "Bearer " + Store.token, "Content-Type": "application/json" },
        body: Store.body(),
      })
    } catch { /* best effort */ }
  })
}

/** Re-render on any store change. Returns the store itself. */
export function useStore() {
  useSyncExternalStore((fn) => Store.subscribe(fn), () => Store.snapshot(), () => Store.snapshot())
  return Store
}
