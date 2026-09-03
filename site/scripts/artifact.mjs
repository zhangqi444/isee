/* Turn the single-file build (dist-artifact/index.html) into ../artifact.html,
 * the body-only form the claude.ai Artifact tool wraps in its own skeleton:
 * <title> + font <link>s + <style> + #root + inline <script type="module">. */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.dirname(new URL(import.meta.url).pathname) + "/.."
const src = fs.readFileSync(path.join(ROOT, "dist-artifact/index.html"), "utf8")

const pick = (re) => (src.match(re) || []).join("\n")
const title = pick(/<title>[\s\S]*?<\/title>/)
const links = pick(/<link rel="(?:preconnect|stylesheet)"[^>]*>/g)
const styles = pick(/<style[\s\S]*?<\/style>/g)
const head = src.match(/<head>([\s\S]*)<\/head>/)[1]
const body = src.match(/<body>([\s\S]*)<\/body>/)[1].trim()
// singlefile inlines the app as <script type="module"> in <head>; the data script sits at the top of <body>.
const app = (head.match(/<script type="module"[^>]*>[\s\S]*?<\/script>/g) || []).join("\n")

if (!title || !styles || !app || !/window\.__ISEE__/.test(body)) throw new Error("artifact build looks incomplete")
if (/<script[^>]+src=/.test(src) || /<link[^>]+href="\.\//.test(src)) throw new Error("artifact still references external assets")

const out = [title, links, styles, body, app].join("\n") + "\n"
fs.writeFileSync(path.join(ROOT, "../artifact.html"), out)
console.log("artifact.html", out.length.toLocaleString(), "bytes")
