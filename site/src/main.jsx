import React from "react"
import ReactDOM from "react-dom/client"

import "./index.css"
import App from "./App"
import { setBundle } from "./lib/content"
import { DRIVE_ENABLED, Store } from "./lib/store"
import { backfill } from "./lib/engine"
import { syncBadges } from "./lib/rewards"

/* Theme: saved choice > host's data-theme (the artifact viewer sets it) > OS. */
function applyTheme() {
  const pref = Store.s && Store.s.theme
  const host = document.documentElement.getAttribute("data-theme")
  const sys = matchMedia("(prefers-color-scheme: dark)").matches
  const dark = pref ? pref === "dark" : host ? host === "dark" : sys
  document.documentElement.classList.toggle("dark", dark)
  Store.setDark(dark)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute("content", dark ? "#101614" : "#0F7A6B")
}

function boot(bundle) {
  setBundle(bundle)
  Store.init()
  applyTheme()
  Store.subscribe(applyTheme)
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme)
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
  if (bundle.seed) Store.applySeed(bundle.seed)
  // Learning records for everything answered before the engine existed; again after every Drive merge.
  backfill()
  syncBadges()
  Store.afterMerge = () => { backfill(); syncBadges() }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  // Resume the Drive session if the stored token is still good. Never open the
  // Google popup on load: with no click behind it, browsers block it anyway.
  if (DRIVE_ENABLED) Store.resume()
}

function fail(msg) {
  document.getElementById("root").innerHTML =
    '<div style="max-width:40ch;margin:15vh auto;padding:24px;text-align:center;font:15px/1.5 system-ui">' +
    "<h2 style='margin:0 0 8px'>Questions could not load</h2><p style='margin:0;opacity:.7'>" + msg + "</p></div>"
}

if (window.__ISEE__) boot(window.__ISEE__)
else fetch("content/bundle.json").then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json() }).then(boot)
  .catch((e) => fail("content/bundle.json did not load (" + e.message + ")."))
