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

const listeners = new Set()
let version = 0
function emit() { version++; listeners.forEach((f) => f()) }

export const Store = {
  s: null,
  token: null, tokenExp: 0, folderId: null, fileId: null, pushTimer: null, tc: null,
  status: "local",          // local | connecting | syncing | live | error | unavailable
  email: null,
  lastSync: null,

  init() {
    this.s = lsLoad()
    this.s.results = this.s.results || {}
    return this.s
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
    this.s.seedApplied = seed.version
    lsSave(this.s)
    return added
  },
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
            this.afterAuth()
          } else { this.setStatus("local") }
        },
        error_callback: (err) => {
          console.warn("oauth", err)
          this.lastError = err && (err.message || err.type)
          this.setStatus("error")
        },
      })
    }
    this.setStatus("connecting")
    this.tc.requestAccessToken({ prompt: this.token ? "" : "consent" })
  },
  signOut() {
    this.token = null; this.tokenExp = 0; this.folderId = null; this.fileId = null
    this.email = null; this.setDriveOptIn(false); this.setStatus("local")
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
      .then((u) => { this.email = u && u.email }).catch(() => {})
      .then(() => this.ensureFolder())
      .then(() => this.pull())
      .then(() => { this.lastSync = new Date(); this.setStatus("live") })
      .catch((e) => { console.warn("drive sync failed", e); this.lastError = String(e.message || e); this.setStatus("error") })
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
    const local = this.s.results
    for (const k of Object.keys(remote.results)) {
      const rr = remote.results[k], lr = local[k]
      if (!lr || (rr.at || "") >= (lr.at || "")) local[k] = rr   // last-write-wins by timestamp
    }
    lsSave(this.s); emit()
  },
  schedulePush() {
    if (!this.valid() || !this.folderId) return
    clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => this.push().then(() => { this.lastSync = new Date(); this.setStatus("live") }).catch(() => this.setStatus("error")), 1200)
  },
  push() {
    if (!this.valid() || !this.folderId) return Promise.resolve()
    const body = JSON.stringify({ schema: 1, savedAt: new Date().toISOString(), results: this.s.results })
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
