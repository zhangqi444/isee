import * as React from "react"
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, ListChecks, Plus, Printer, Trash2 } from "lucide-react"

import { D, ORDER, SUBJ, allWrong, currentWeek, setId, setsFor, weekLabel } from "@/lib/content"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { precisionSummary } from "@/pages/precision"
import { essayStatus } from "@/pages/essay"
import { mockSummary } from "@/pages/mock"
import { allEvents } from "@/pages/calendar"

/* ---------- date helpers ---------- */
const iso = (d) => d.toISOString().slice(0, 10)
function addDays(s, n) { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d) }
function weekRange(wk) { const a = D.starts[wk]; return [a, addDays(a, 6)] }
function monthKey(s) { return s.slice(0, 7) }
function monthLabel(key) { return new Date(key + "-01T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" }) }
function shiftMonth(key, n) { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` }
const fmt = (s) => new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })

/* ---------- checklist state: { [key]: { checked: {id: true}, custom: [{id, text, done}], at } } ---------- */
function listState(key) { return (Store.s.checklists || {})[key] || { checked: {}, custom: [] } }
function setList(key, fn) {
  if (!Store.s.checklists) Store.s.checklists = {}
  Store.setSlice("checklists", key, (cur) => fn({ checked: {}, custom: [], ...cur }))
}

/* ---------- auto items ---------- */
/** Everything the plan expects in week `wk`, with live done-state. */
export function weekItems(wk) {
  const items = []
  const [a, b] = weekRange(wk)
  for (const s of ORDER) {
    if (s === "vr" && D.precision && D.precision[wk]) {
      const ps = precisionSummary(wk)
      items.push({ id: `prec:${wk}`, group: SUBJ.vr.name, label: "Session 1 · Precision review — 20 words in your own words", sub: "20–25 min", done: ps.submitted, path: `/precision/${wk}`, auto: true })
    }
    setsFor(s, wk).forEach((set, n) => {
      const r = Store.s.results[setId(s, wk, n)]
      items.push({ id: `set:${s}:${wk}:${n}`, group: SUBJ[s].name, label: `Set ${n + 1} — ${set.length} questions`, sub: r ? `${r.right}/${r.n}` : "one sitting, no notes", done: !!r, path: `/run/${s}/${wk}/${n}`, auto: true })
    })
  }
  if (D.essay && D.essay.weeks[wk]) {
    const st = essayStatus(wk)
    items.push({ id: `essay:${wk}`, group: "Essay", label: `Weekly essay — ${D.essay.weeks[wk].focus}`, sub: "5 plan · 20 draft · 5 revise", done: st === "complete", path: `/essay/${wk}`, auto: true })
  }
  const misses = allWrong().length
  items.push({ id: `review:${wk}`, group: "Review", label: misses ? `Clear the review pile — ${misses} to try again` : "Review pile is empty", sub: "due review comes before new work", done: misses === 0, path: "/review", auto: true })
  for (const m of D.mocks) {
    if (m.start >= a && m.start <= b) {
      const sm = mockSummary(m.id)
      items.push({ id: `mock:${m.id}`, group: "Mock exam", label: `${m.name} — ${m.blurb}`, sub: sm.complete ? `${sm.right}/${sm.n} raw` : `${sm.done}/${sm.total} sections`, done: sm.complete, path: `/mock/${m.id}`, auto: true })
    }
  }
  for (const e of allEvents()) {
    if (e.kind === "week" || e.kind === "mock" || e.kind === "season") continue
    if (e.date >= a && e.date <= b) items.push({ id: `ev:${e.id}`, group: "Calendar", label: `${fmt(e.date)} · ${e.title}`, sub: e.detail || "", done: null, path: e.path || "/calendar", auto: false })
  }
  return items
}

/** Month view: the weeks that fall in the month, mocks, calendar events and the parent to-dos. */
export function monthItems(key) {
  const items = []
  for (const w of D.weeks) {
    const [a, b] = weekRange(w.w)
    if (monthKey(a) !== key && monthKey(b) !== key) continue
    const wi = weekItems(w.w).filter((x) => x.auto)
    const done = wi.filter((x) => x.done).length
    items.push({ id: `wk:${w.w}`, group: "Plan weeks", label: `${w.w} · ${w.label}`, sub: `${done} of ${wi.length} tasks done`, done: wi.length > 0 && done === wi.length, path: `/checklist/${w.w}`, auto: true, pct: wi.length ? done / wi.length : 0 })
  }
  for (const m of D.mocks) if (monthKey(m.start) === key) {
    const sm = mockSummary(m.id)
    items.push({ id: `mock:${m.id}`, group: "Mock exams", label: `${m.name} — ${m.label}`, sub: sm.complete ? `${sm.right}/${sm.n} raw` : m.blurb, done: sm.complete, path: `/mock/${m.id}`, auto: true })
  }
  for (const e of allEvents()) {
    if (e.kind === "week" || e.kind === "mock") continue
    if (monthKey(e.date) === key || (e.end && e.date <= key + "-31" && e.end >= key + "-01" && e.kind === "season")) items.push({ id: `ev:${e.id}`, group: "Dates", label: `${fmt(e.date)}${e.end ? " → " + fmt(e.end) : ""} · ${e.title}`, sub: e.detail || "", done: null, path: e.path || "/calendar", auto: false })
  }
  for (const t of ((D.calendar.monthly || {})[key] || [])) items.push({ id: `todo:${key}:${t.id}`, group: "Parent to-dos", label: t.text, sub: t.why || "", done: null, path: t.path || null, auto: false })
  return items
}

/* ---------- UI ---------- */
function Row({ item, listKey }) {
  const st = listState(listKey)
  const manual = item.done == null
  const done = manual ? !!st.checked[item.id] : item.done
  function toggle() { if (!manual) return; setList(listKey, (cur) => ({ ...cur, checked: { ...cur.checked, [item.id]: !cur.checked[item.id] } })) }
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2.5", done && "opacity-70")} data-testid="ck-item" data-done={done ? "1" : "0"}>
      <button type="button" onClick={toggle} disabled={!manual} aria-label={done ? "Done" : "Not done"} className={cn("mt-0.5 shrink-0 rounded-full", manual ? "cursor-pointer" : "cursor-default")}>
        {done ? <CheckCircle2 className="text-success size-5" /> : <Circle className="text-muted-foreground size-5" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        {item.path ? (
          <button type="button" className={cn("text-left text-sm font-medium hover:underline", done && "line-through decoration-muted-foreground/60")} onClick={() => go(item.path)}>{item.label}</button>
        ) : (
          <span className={cn("text-sm font-medium", done && "line-through decoration-muted-foreground/60")}>{item.label}</span>
        )}
        {item.sub ? <span className="text-muted-foreground text-xs">{item.sub}</span> : null}
        {item.pct != null ? <Progress value={item.pct * 100} className="mt-1 h-1" /> : null}
      </div>
      {!manual && !done ? <Badge variant="outline" className="text-muted-foreground shrink-0">auto</Badge> : null}
    </li>
  )
}

function CustomItems({ listKey }) {
  useStore()
  const st = listState(listKey)
  const [text, setText] = React.useState("")
  function add() {
    const t = text.trim(); if (!t) return
    setList(listKey, (cur) => ({ ...cur, custom: [...cur.custom, { id: "c" + Date.now(), text: t, done: false }] }))
    setText("")
  }
  function toggle(id) { setList(listKey, (cur) => ({ ...cur, custom: cur.custom.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) })) }
  function remove(id) { setList(listKey, (cur) => ({ ...cur, custom: cur.custom.filter((c) => c.id !== id) })) }
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle>Your own items</CardTitle>
        <CardDescription>Anything else for this period — a tutor session, a book to finish, a reward. Saved and synced.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-5">
        {st.custom.length ? (
          <ul className="divide-y rounded-md border">
            {st.custom.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2" data-testid="ck-custom">
                <button type="button" onClick={() => toggle(c.id)} aria-label={c.done ? "Done" : "Not done"}>{c.done ? <CheckCircle2 className="text-success size-5" /> : <Circle className="text-muted-foreground size-5" />}</button>
                <span className={cn("flex-1 text-sm", c.done && "text-muted-foreground line-through")}>{c.text}</span>
                <Button size="icon-sm" variant="ghost" onClick={() => remove(c.id)} aria-label="Remove"><Trash2 /></Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add() }} placeholder="Add an item and press Enter" data-testid="ck-add" />
          <Button variant="outline" onClick={add}><Plus /> Add</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Grouped({ items, listKey }) {
  const groups = []
  for (const it of items) { let g = groups.find((x) => x.name === it.group); if (!g) { g = { name: it.group, items: [] }; groups.push(g) } g.items.push(it) }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <Card key={g.name} className="gap-2 py-4">
          <CardHeader className="px-5"><CardTitle className="text-base">{g.name}</CardTitle></CardHeader>
          <CardContent className="px-2"><ul className="divide-y">{g.items.map((it) => <Row key={it.id} item={it} listKey={listKey} />)}</ul></CardContent>
        </Card>
      ))}
    </div>
  )
}

export function Checklist({ wk: wkParam, month: monthParam }) {
  useStore()
  const cur = currentWeek()
  const wk = wkParam && D.starts[wkParam] ? wkParam : cur
  const idx = D.weeks.findIndex((w) => w.w === wk)
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthKey(iso(new Date()))
  const tab = monthParam ? "month" : "week"

  const wItems = weekItems(wk), wAuto = wItems.filter((x) => x.auto), wDone = wAuto.filter((x) => x.done).length
  const mItems = monthItems(month)
  const [a, b] = weekRange(wk)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-3 print:hidden">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><ListChecks className="size-4" /> Checklist</CardDescription>
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight">Everything the plan expects, ticked off as it happens</CardTitle>
          <CardDescription>Sets, the precision review, the essay, the review pile and mocks tick themselves when finished. Dates and parent to-dos are ticked by hand. Add your own items to either list.</CardDescription>
          <CardAction><Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Print</Button></CardAction>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={(v) => go(v === "week" ? `/checklist/${wk}` : `/checklist/month/${month}`)}>
        <TabsList className="print:hidden">
          <TabsTrigger value="week">This week</TabsTrigger>
          <TabsTrigger value="month">This month</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="flex flex-col gap-4">
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <div className="flex items-center gap-2 print:hidden">
                <Button size="icon-sm" variant="ghost" disabled={idx <= 0} onClick={() => go(`/checklist/${D.weeks[idx - 1].w}`)} aria-label="Previous week"><ChevronLeft /></Button>
                <Button size="icon-sm" variant="ghost" disabled={idx >= D.weeks.length - 1} onClick={() => go(`/checklist/${D.weeks[idx + 1].w}`)} aria-label="Next week"><ChevronRight /></Button>
                {wk !== cur && <Button size="sm" variant="ghost" onClick={() => go(`/checklist/${cur}`)}>Back to this week</Button>}
              </div>
              <CardTitle className="font-serif text-xl">{wk} · {weekLabel(wk)} {wk === cur && <Badge>This week</Badge>}</CardTitle>
              <CardDescription>{fmt(a)} – {fmt(b)} · {wDone} of {wAuto.length} plan tasks done</CardDescription>
              <CardAction><span className="font-serif text-2xl font-semibold tabular-nums">{wAuto.length ? Math.round((wDone / wAuto.length) * 100) : 0}%</span></CardAction>
            </CardHeader>
            <CardContent className="px-5"><Progress value={wAuto.length ? (wDone / wAuto.length) * 100 : 0} className="h-1.5" /></CardContent>
          </Card>
          <Grouped items={wItems} listKey={wk} />
          <CustomItems listKey={wk} />
        </TabsContent>

        <TabsContent value="month" className="flex flex-col gap-4">
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <div className="flex items-center gap-2 print:hidden">
                <Button size="icon-sm" variant="ghost" onClick={() => go(`/checklist/month/${shiftMonth(month, -1)}`)} aria-label="Previous month"><ChevronLeft /></Button>
                <Button size="icon-sm" variant="ghost" onClick={() => go(`/checklist/month/${shiftMonth(month, 1)}`)} aria-label="Next month"><ChevronRight /></Button>
                {month !== monthKey(iso(new Date())) && <Button size="sm" variant="ghost" onClick={() => go(`/checklist/month/${monthKey(iso(new Date()))}`)}>Back to this month</Button>}
              </div>
              <CardTitle className="font-serif text-xl flex items-center gap-2"><CalendarDays className="size-5" /> {monthLabel(month)}</CardTitle>
              <CardDescription>{mItems.length ? `${mItems.filter((x) => x.auto).filter((x) => x.done).length} of ${mItems.filter((x) => x.auto).length} plan items done · ${mItems.filter((x) => !x.auto).length} dates and to-dos` : "Nothing scheduled this month."}</CardDescription>
            </CardHeader>
          </Card>
          {mItems.length ? <Grouped items={mItems} listKey={month} /> : null}
          <CustomItems listKey={month} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
