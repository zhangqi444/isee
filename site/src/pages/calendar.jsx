import * as React from "react"
import { CalendarDays, ExternalLink, MapPin, Save, Timer } from "lucide-react"

import { mockBand } from "@/lib/engine"
import { D, fmtDate } from "@/lib/content"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
const KIND = {
  week: { label: "Plan week", cls: "bg-secondary text-secondary-foreground" },
  mock: { label: "Mock exam", cls: "bg-primary text-primary-foreground" },
  correction: { label: "Correction week", cls: "bg-warning-soft text-warning" },
  season: { label: "ISEE season", cls: "border-primary/50 text-primary" },
  "school-test": { label: "ISEE sitting", cls: "bg-chart-2/15 text-chart-2" },
  deadline: { label: "Deadline", cls: "bg-destructive/10 text-destructive" },
  reminder: { label: "Reminder", cls: "bg-warning-soft text-warning" },
  decision: { label: "Decisions", cls: "bg-success-soft text-success" },
  test: { label: "Test day", cls: "bg-primary text-primary-foreground" },
}
const FORMATS = ["Prometric test center (Mountlake Terrace)", "ISEE at Home (online)", "School test site", "Not decided yet"]

/** "Oct 26 – Nov 1" (with the plan's year) -> ISO start date. */
function parseLabelStart(label, year = 2026) {
  const m = label.match(/^([A-Z][a-z]{2})\s+(\d{1,2})/)
  if (!m) return null
  const mo = MONTHS[m[1]]
  return `${mo === 0 ? year + 1 : year}-${String(mo + 1).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`
}
function iso(d) { return d.toISOString().slice(0, 10) }
function fmtDay(s) { const d = new Date(s + "T00:00:00"); return { wd: d.toLocaleDateString(undefined, { weekday: "short" }), day: d.getDate(), month: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), key: s.slice(0, 7) } }
function fmtShort(s) { return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }) }

/** All calendar events, plan + research + personal, sorted. */
export function allEvents() {
  const ev = []
  for (const w of D.weeks) {
    const e = D.essay && D.essay.weeks[w.w]
    const end = new Date(D.starts[w.w] + "T00:00:00"); end.setDate(end.getDate() + 6)
    ev.push({ id: "wk-" + w.w, kind: "week", date: D.starts[w.w], end: iso(end), title: `${w.w} · plan week`, detail: e ? `Essay focus: ${e.focus}` : "", path: "/s/vr/" + w.w })
  }
  const band = mockBand()
  for (const m of D.mocks) {
    const done = band.mocks.find((x) => x.form === m.id)
    ev.push({ id: "mock-" + m.id, kind: "mock", date: m.start, title: done ? `${m.name} · ${done.pct}% · stanine ≈${done.st}` : m.name, detail: done ? `Finished ${fmtDate(done.at)}. ${m.blurb}` : m.blurb, path: "/mock/" + m.id })
  }
  for (const b of D.breaks || []) {
    if (/mock/i.test(b.what)) continue                       // mocks come from D.mocks with real dates
    const d = parseLabelStart(b.label)
    if (d) ev.push({ id: "brk-" + d, kind: "correction", date: d, title: b.what, detail: `${b.label} · reteach each miss, redo, then a fresh delayed-retest item.` })
  }
  for (const e of D.calendar.events) ev.push({ ...e })
  if (Store.s.testDate) ev.push({ id: "test", kind: "test", date: Store.s.testDate, title: "Sheila's ISEE — test day", detail: Store.s.testFormat || "" })
  return ev.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "season" ? -1 : 1))
}
export function upcoming(n = 4, from = iso(new Date())) {
  return allEvents().filter((e) => (e.end || e.date) >= from && e.kind !== "week").slice(0, n)
}

function TestDayCard() {
  const store = useStore()
  const [date, setDate] = React.useState(store.s.testDate || "")
  const [format, setFormat] = React.useState(store.s.testFormat || "")
  const today = iso(new Date())
  const days = store.s.testDate ? Math.round((new Date(store.s.testDate + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000) : null
  function save() { Store.setPref("testDate", date || null); Store.setPref("testFormat", format || null) }
  const sittings = D.calendar.events.filter((e) => e.kind === "school-test")
  return (
    <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
      <CardHeader>
        <CardDescription className="flex items-center gap-2"><Timer className="size-4" /> Sheila's real ISEE date</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {store.s.testDate ? (days > 0 ? `${days} days to go` : days === 0 ? "Today" : `${-days} days ago`) : "Which day will she take the real test?"}
        </CardTitle>
        <CardDescription>
          {store.s.testDate
            ? `${new Date(store.s.testDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${store.s.testFormat ? " · " + store.s.testFormat : ""}`
            : "Today is known; this is the target the countdown counts down to. Nothing is booked yet — pick a planned date now (you can change it any time) or the exact date once it is booked."}
        </CardDescription>
      </CardHeader>
      {!store.s.testDate && sittings.length ? (
        <CardContent className="flex flex-wrap items-center gap-2 pb-0">
          <span className="text-muted-foreground text-xs">Known sittings nearby:</span>
          {sittings.map((e) => (
            <Button key={e.id} size="sm" variant="outline" onClick={() => { setDate(e.date); setFormat("School test site") }} data-testid={`pick-${e.id}`}>
              {fmtShort(e.date)} · {e.title.replace(/^ISEE at /, "")}
            </Button>
          ))}
        </CardContent>
      ) : null}
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="testDate" className="text-muted-foreground text-xs">Date</Label>
          <Input id="testDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" data-testid="test-date" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="testFormat" className="text-muted-foreground text-xs">Where</Label>
          <select id="testFormat" value={format} onChange={(e) => setFormat(e.target.value)} className="border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs">
            <option value="">Choose…</option>
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <Button onClick={save} disabled={date === (store.s.testDate || "") && format === (store.s.testFormat || "")} data-testid="test-save"><Save /> Save</Button>
      </CardContent>
    </Card>
  )
}

export function Calendar() {
  useStore()
  const events = allEvents()
  const today = iso(new Date())
  const months = []
  let todayPlaced = false
  for (const e of events) {
    const f = fmtDay(e.date)
    let m = months[months.length - 1]
    if (!m || m.key !== f.key) { m = { key: f.key, label: f.month, rows: [] }; months.push(m) }
    if (!todayPlaced && e.date > today) { m.rows.push({ today: true }); todayPlaced = true }
    m.rows.push({ e, f })
  }
  const lvl = D.calendar.level

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <TestDayCard />

      <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-[1fr_1fr]">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>{lvl.name}</CardTitle>
            <CardDescription>{lvl.total}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="leading-relaxed">{lvl.order}</p>
            <p className="text-muted-foreground leading-relaxed">{lvl.rule}</p>
            <a className="text-primary inline-flex items-center gap-1 text-xs" href={lvl.source} target="_blank" rel="noreferrer">Official overview <ExternalLink className="size-3" /></a>
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Ways to sit the test</CardTitle>
            <CardDescription>{D.calendar.scores.detail}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y text-sm">
            {D.calendar.formats.map((f) => (
              <div key={f.name} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                <div className="flex items-center gap-1.5 font-medium"><MapPin className="text-muted-foreground size-3.5" /> {f.name}</div>
                <p className="text-muted-foreground leading-relaxed">{f.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarDays className="size-5" /> Timeline</h2>
        <p className="text-muted-foreground text-sm">Plan weeks, mocks, and the real ISEE windows for the Seattle area (researched {D.calendar.researched_at}). Tap a plan week or mock to open it.</p>
      </div>

      {months.map((m) => (
        <Card key={m.key} className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-3"><CardTitle className="text-base">{m.label}</CardTitle></CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y">
              {m.rows.map((row, idx) => row.today ? (
                <li key="today" className="text-primary flex items-center gap-2 px-5 py-1.5 text-xs font-semibold tracking-wide uppercase" data-testid="today-marker"><span className="bg-primary size-2 rounded-full" /> Today</li>
              ) : (
                <li key={row.e.id + idx} className={cn("flex gap-4 px-5 py-3", row.e.date < today && (row.e.end || row.e.date) < today && "opacity-60", row.e.kind === "season" && "bg-primary/5")}>
                  <div className="w-11 shrink-0 text-center">
                    <div className="text-muted-foreground text-[11px] uppercase">{row.f.wd}</div>
                    <div className="text-xl leading-none font-semibold tabular-nums">{row.f.day}</div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("border-transparent", KIND[row.e.kind]?.cls)}>{KIND[row.e.kind]?.label || row.e.kind}</Badge>
                      {row.e.path ? (
                        <button type="button" className="text-left font-medium hover:underline" onClick={() => go(row.e.path)}>{row.e.title}</button>
                      ) : (
                        <span className="font-medium">{row.e.title}</span>
                      )}
                      {row.e.end && row.e.kind !== "week" ? <span className="text-muted-foreground text-xs">→ {fmtShort(row.e.end)}</span> : null}
                    </div>
                    {row.e.detail ? <p className="text-muted-foreground text-sm leading-relaxed">{row.e.detail}</p> : null}
                    {row.e.source ? <a className="text-primary inline-flex items-center gap-1 text-xs" href={row.e.source} target="_blank" rel="noreferrer">Source <ExternalLink className="size-3" /></a> : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
