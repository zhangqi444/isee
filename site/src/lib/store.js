/* Persistence: localStorage first, mirrored to a JSON file in the user's own
 * Google Drive once they authorize the site (scope: drive.file — the app can
 * only see files it created, inside the folder it created). */
import { useSyncExternalStore } from "react"

const KEY = "isee.v1"
const FOLDER = "Sheila ISEE Practice"
const FILE = "progress.json"
const CLIENT_ID = (typeof window !== "undefined" && window.__OAUTH_CLIENT_ID__) || ""
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
  status: "local",          // local | connecting | syncing | live | expired | error | unavailable
  email: null,
  lastSync: null,

  init() {
    this.s = lsLoad()
    this.s.results = this.s.results || {}
    for (const k of ["precision", "essays", "mocks", "checklists", "items", "mixed", "badges", "rewards", "books"]) if (!this.s[k] || typeof this.s[k] !== "object") this.s[k] = {}
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
    if (d && d.token && d.exp > Date.now()) { this.token = d.token; this.tokenExp = d.exp; this.email = d.email || null }
    else if (this.s.driveOptIn && DRIVE_ENABLED) this.status = "expired"
    return this.s
  },
  /** Called once at boot: silently reconnect if the stored token is still good. */
  resume() {
    if (this.valid()) this.afterAuth()
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

  /* ---- Google Drive ---- */
  /* Must be called from a click: Google opens a popup, and browsers block popups
   * that no gesture started. The consent screen is shown only the first time;
   * later reconnects use prompt:'' and the popup closes itself. */
  signIn() {
    this.setDriveOptIn(true)
    if (!DRIVE_ENABLED || !window.google || !google.accounts || !google.accounts.oauth2) {
      this.setStatus("unavailable"); return
    }
    if (!this.tc) {
      this.tc = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: "https://www.googleapis.com/auth/drive.file openid email profile",
        callback: (resp) => {
          if (resp && resp.access_token) {
            this.token = resp.access_token
            this.tokenExp = Date.now() + (resp.expires_in || 3600) * 1000 - 60000
            this.s.driveGranted = true
            this.saveSession()
            this.afterAuth()
          } else {
            this.lastError = resp && resp.error ? `Google said: ${resp.error_description || resp.error}` : "Sign-in was cancelled."
            this.setStatus(resp && resp.error === "access_denied" ? "error" : "local")
          }
        },
        error_callback: (err) => {
          console.warn("oauth", err)
          this.lastError = err && err.type === "popup_failed_to_open"
            ? "Your browser blocked the sign-in window. Allow pop-ups for this site and try again."
            : err && err.type === "popup_closed" ? "The sign-in window was closed before finishing."
            : (err && (err.message || err.type)) || "Sign-in failed."
          this.setStatus(err && err.type === "popup_closed" ? (this.s.driveGranted ? "expired" : "local") : "error")
        },
      })
    }
    this.setStatus("connecting")
    this.tc.requestAccessToken({ prompt: this.s.driveGranted ? "" : "consent" })
  },
  saveSession() {
    this.s.drive = { token: this.token, exp: this.tokenExp, email: this.email }
    lsSave(this.s)
  },
  signOut() {
    const t = this.token
    this.token = null; this.tokenExp = 0; this.folderId = null; this.fileId = null; this.email = null
    delete this.s.drive; delete this.s.driveGranted
    this.setDriveOptIn(false); this.setStatus("local")
    if (t && window.google && google.accounts && google.accounts.oauth2) { try { google.accounts.oauth2.revoke(t) } catch { /* ignore */ } }
  },
  valid() { return this.token && Date.now() < this.tokenExp },
  api(url, opts = {}) {
    opts.headers = Object.assign({}, opts.headers, { Authorization: "Bearer " + this.token })
    return fetch(url, opts).then((r) => {
      if (!r.ok) throw new Error("Drive " + r.status + " " + url.split("?")[0])
      return r
    })
  },
  afterAuth() {
    this.setStatus("syncing")
    this.api("https://www.googleapis.com/oauth2/v3/userinfo").then((r) => r.json())
      .then((u) => { this.email = u && u.email; this.saveSession() }).catch(() => {})
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
  pull() {
    return this.findFile().then((id) => {
      if (!id) return this.push()                       // nothing remote yet -> seed it from local
      return this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)
        .then((r) => r.json())
        .then((remote) => { this.merge(remote); return this.push() })
    })
  },
  merge(remote) {
    if (!remote || !remote.results) return
    // keyed slices: last-write-wins per key by `at`
    for (const slice of ["precision", "essays", "mocks", "checklists", "mixed", "badges", "rewards", "books"]) {
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
    if (!this.valid()) { if (this.s.driveOptIn && DRIVE_ENABLED && this.status !== "expired") this.setStatus("expired"); return }
    if (!this.folderId) return
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => this.push().then(() => { this.lastSync = new Date(); this.setStatus("live") }).catch(() => this.setStatus("error")), 1200)
  },
  push() {
    if (!this.valid() || !this.folderId) return Promise.resolve()
    const body = JSON.stringify({ schema: 4, savedAt: new Date().toISOString(), results: this.s.results,
      precision: this.s.precision, essays: this.s.essays, mocks: this.s.mocks, checklists: this.s.checklists, items: this.s.items, mixed: this.s.mixed,
      badges: this.s.badges, rewards: this.s.rewards, books: this.s.books, booksSeeded: !!this.s.booksSeeded,
      testDate: this.s.testDate || null, testFormat: this.s.testFormat || null, pacing: !!this.s.pacing })
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

/** Re-render on any store change. Returns the store itself. */
export function useStore() {
  useSyncExternalStore((fn) => Store.subscribe(fn), () => Store.snapshot(), () => Store.snapshot())
  return Store
}
