import * as React from "react"
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, ListChecks, Plus, Printer, Trash2 } from "lucide-react"

import { D, ORDER, SUBJ, currentWeek, setId, setsFor, weekLabel } from "@/lib/content"
import { mockNextSteps, rec, reviewQueue } from "@/lib/engine"
import { actionsForWeek, reviewsFor } from "@/lib/reviews"
import { ReviewCard } from "@/components/review-card"
import { mixedThisWeek } from "@/pages/mixed"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { precisionSummary } from "@/pages/precision"
import { essayStatus, essayTime } from "@/pages/essay"
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
      items.push({ id: `prec:${wk}`, group: SUBJ.vr.name, tag: SUBJ.vr.short, short: "Precision review", label: "Session 1 · Precision review — 20 words in your own words", sub: "20–25 min", done: ps.submitted, path: `/precision/${wk}`, auto: true })
      const quizzed = (D.precision[wk].words || []).some((e) => { const r = rec("w:" + e.word); return r && (r.hist || []).some((h) => h.ctx === "vocab") })
      items.push({ id: `quiz:${wk}`, group: SUBJ.vr.name, tag: SUBJ.vr.short, short: "Word quiz", label: "Word quiz — the same 20 words as ISEE synonym questions", sub: "a day after Session 1", done: quizzed, path: `/precision/${wk}/quiz`, auto: true })
    }
    setsFor(s, wk).forEach((set, n) => {
      const r = Store.s.results[setId(s, wk, n)]
      items.push({ id: `set:${s}:${wk}:${n}`, group: SUBJ[s].name, tag: SUBJ[s].short, short: `Set ${n + 1}`, label: `Set ${n + 1} — ${set.length} questions`, sub: r ? `${r.right}/${r.n}` : "one sitting, no notes", done: !!r, path: `/run/${s}/${wk}/${n}`, auto: true })
    })
  }
  if (D.essay && D.essay.weeks[wk]) {
    const st = essayStatus(wk), t = essayTime(wk)
    items.push({ id: `essay:${wk}`, group: "Essay", tag: "Essay", short: "Weekly essay", label: `Weekly essay — ${D.essay.weeks[wk].focus}`, sub: t.total != null ? `${t.total} min logged` : "5 plan · 20 draft · 5 revise", done: st === "complete", path: `/essay/${wk}`, auto: true })
  }
  const q = reviewQueue(), due = q.due.length
  items.push({ id: `review:${wk}`, group: "Review", tag: "Review", short: due ? `Review ${due} due` : "Review pile", label: due ? `Clear the review pile — ${due} due now` : q.scheduled.length ? `Review pile clear — ${q.scheduled.length} scheduled for later` : "Review pile is empty", sub: "due review comes before new work", done: due === 0, path: "/review", auto: true })
  if (wk !== "W1") items.push({ id: `mixed:${wk}`, group: "Mixed practice", tag: "Mixed", short: "Mixed set", label: "One mixed set — 12 questions across all four subjects", sub: "promotes Proficient skills to Mastered", done: mixedThisWeek([a, b]), path: "/mixed", auto: true })
  for (const m of D.mocks) {
    if (m.start >= a && m.start <= b) {
      const sm = mockSummary(m.id)
      items.push({ id: `mock:${m.id}`, group: "Mock exam", tag: "Mock", short: m.name, label: `${m.name} — ${m.blurb}`, sub: sm.complete ? `${sm.right}/${sm.n} raw` : `${sm.done}/${sm.total} sections`, done: sm.complete, path: `/mock/${m.id}`, auto: true })
    }
    // follow-up steps in the week of the mock and the week after
    const fin = (Store.s.mocks[m.id] || {}).finishedAt
    if (fin) { const f = fin.slice(0, 10); if (f >= addDays(a, -7) && f <= b) mockNextSteps(m.id).filter((x) => x.kind !== "tag").forEach((x, i) => items.push({ id: `next:${m.id}:${i}`, group: "Mock follow-up", tag: "Mock", label: x.text, sub: `from ${m.name}`, done: null, path: x.path, auto: false })) }
  }
  // Follow-ups a weekly or monthly digest asked for. Not `auto`, so they never move the
  // plan's own progress — they are extra work someone chose, ticked by hand.
  for (const x of actionsForWeek(wk)) items.push({ id: x.id, group: "Follow-up", tag: "Follow-up", label: x.text, sub: `from ${x.from}`, done: null, path: x.path, auto: false })
  for (const e of allEvents()) {
    if (e.kind === "week" || e.kind === "mock" || e.kind === "season") continue
    if (e.date >= a && e.date <= b) items.push({ id: `ev:${e.id}`, group: "Calendar", tag: "Date", label: `${fmt(e.date)} · ${e.title}`, sub: e.detail || "", done: null, path: e.path || "/calendar", auto: false })
  }
  return items
}
/** Follow-ups for this week she has not ticked yet — for the dashboard. */
export function followUpsLeft(wk) {
  const st = listState(wk)
  return actionsForWeek(wk).filter((x) => !st.checked[x.id])
}

/** How much of this week is still outstanding. */
export function weekLeft(wk = currentWeek()) {
  const auto = weekItems(wk).filter((x) => x.auto)
  const left = auto.filter((x) => !x.done)
  return { left: left.length, total: auto.length, done: auto.length - left.length, items: left }
}
/** The next thing to do, in the order the plan expects it. Due review comes before
 *  new work; after that it is this week's own list, top to bottom; when the week is
 *  clear it points at the first set of the next week. */
export function nextUp() {
  const cur = currentWeek()
  const q = reviewQueue()
  if (q.due.length) return { label: `Review ${q.due.length} due`, note: "due work comes before new work", path: "/review", kind: "review" }
  const left = weekLeft(cur).items.filter((x) => x.path)
  if (left.length) { const it = left[0]; return { label: `${it.tag} · ${it.short || it.label}`, note: it.sub || "", path: it.path, kind: "week", wk: cur } }
  const i = D.weeks.findIndex((w) => w.w === cur)
  for (const w of D.weeks.slice(i + 1)) {
    const nx = weekLeft(w.w).items.filter((x) => x.path)[0]
    if (nx) return { label: `${nx.tag} · ${nx.short || nx.label}`, note: `${w.w} — ahead of the plan`, path: nx.path, kind: "ahead", wk: w.w }
  }
  return null
}

/** Parent to-dos for a month that have not been ticked yet. */
export function monthTodosLeft(key) {
  const st = listState(key)
  return ((D.calendar.monthly || {})[key] || []).filter((t) => !st.checked[`todo:${key}:${t.id}`]).length
}
export const thisMonthKey = () => monthKey(iso(new Date()))

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
function isDone(item, listKey) { return item.done == null ? !!listState(listKey).checked[item.id] : item.done }

function Row({ item, listKey, compact, testId = "ck-item" }) {
  const manual = item.done == null
  const done = isDone(item, listKey)
  function toggle() { if (!manual) return; setList(listKey, (cur) => ({ ...cur, checked: { ...cur.checked, [item.id]: !cur.checked[item.id] } })) }
  return (
    <li className={cn("flex items-start gap-3 px-3", compact ? "py-2" : "py-2.5", done && "opacity-70")} data-testid={testId} data-done={done ? "1" : "0"}>
      <button type="button" onClick={toggle} disabled={!manual} aria-label={done ? "Done" : "Not done"} className={cn("mt-0.5 shrink-0 rounded-full", manual ? "cursor-pointer" : "cursor-default")}>
        {done ? <CheckCircle2 className="text-success size-5" /> : <Circle className="text-muted-foreground size-5" />}
      </button>
      {compact && item.tag ? <span className="text-muted-foreground mt-0.5 w-20 shrink-0 truncate text-xs">{item.tag}</span> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {item.path ? (
          <button type="button" className={cn("text-left text-sm font-medium hover:underline", done && "line-through decoration-muted-foreground/60")} onClick={() => go(item.path)}>{item.label}</button>
        ) : (
          <span className={cn("text-sm font-medium", done && "line-through decoration-muted-foreground/60")}>{item.label}</span>
        )}
        {item.sub && !compact ? <span className="text-muted-foreground text-xs">{item.sub}</span> : null}
        {item.pct != null ? <Progress value={item.pct * 100} className="mt-1 h-1" /> : null}
      </div>
      {compact && item.sub && done ? <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{item.sub}</span> : null}
      {!manual && !done && !compact ? <Badge variant="outline" className="text-muted-foreground shrink-0">auto</Badge> : null}
    </li>
  )
}

/** Dashboard card: this week's list with what's left on top, finished work folded away,
 *  a quick-add box and a pointer to the month's parent to-dos. */
export function WeekChecklistCard() {
  useStore()
  const cur = currentWeek()
  const items = weekItems(cur)
  const auto = items.filter((x) => x.auto), done = auto.filter((x) => x.done).length
  const open = items.filter((it) => !isDone(it, cur)), finished = items.filter((it) => isDone(it, cur))
  const st = listState(cur)
  const [showDone, setShowDone] = React.useState(false)
  const [text, setText] = React.useState("")
  const mk = thisMonthKey(), todosLeft = monthTodosLeft(mk)
  function add() {
    const t = text.trim(); if (!t) return
    setList(cur, (c) => ({ ...c, custom: [...c.custom, { id: "c" + Date.now(), text: t, done: false }] }))
    setText("")
  }
  function toggleCustom(id) { setList(cur, (c) => ({ ...c, custom: c.custom.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) })) }
  const customOpen = st.custom.filter((c) => !c.done), customDone = st.custom.filter((c) => c.done)
  const allClear = !open.length && !customOpen.length
  return (
    <Card className="gap-4" data-testid="home-checklist">
      <CardHeader>
        <CardDescription className="flex items-center gap-2"><ListChecks className="size-4" /> This week's checklist</CardDescription>
        <CardTitle className="text-xl">{cur} · {weekLabel(cur)}</CardTitle>
        <CardDescription className="tabular-nums">{done} of {auto.length} plan tasks done{open.length ? ` · ${open.length} left` : ""}</CardDescription>
        <CardAction><Button size="sm" variant="ghost" onClick={() => go(`/checklist/${cur}`)}>Full checklist <ChevronRight /></Button></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Progress value={auto.length ? (done / auto.length) * 100 : 0} className="h-1.5" />
        {allClear ? (
          <div className="text-success flex items-center gap-2 rounded-md border px-3 py-3 text-sm font-medium"><CheckCircle2 className="size-4" /> Everything on this week's list is done.</div>
        ) : (
          <ul className="divide-y rounded-md border">
            {open.map((it) => <Row key={it.id} item={it} listKey={cur} compact />)}
            {customOpen.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2" data-testid="home-custom">
                <button type="button" onClick={() => toggleCustom(c.id)} aria-label="Not done"><Circle className="text-muted-foreground size-5" /></button>
                <span className="text-muted-foreground w-20 shrink-0 text-xs">Yours</span>
                <span className="text-sm font-medium">{c.text}</span>
              </li>
            ))}
          </ul>
        )}
        {finished.length + customDone.length ? (
          <div className="flex flex-col gap-2">
            <button type="button" className="text-muted-foreground self-start text-xs hover:underline" onClick={() => setShowDone((v) => !v)} data-testid="home-toggle-done">
              {showDone ? "Hide" : "Show"} {finished.length + customDone.length} done
            </button>
            {showDone ? (
              <ul className="divide-y rounded-md border">
                {finished.map((it) => <Row key={it.id} item={it} listKey={cur} compact testId="home-done" />)}
                {customDone.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2 opacity-70">
                    <button type="button" onClick={() => toggleCustom(c.id)} aria-label="Done"><CheckCircle2 className="text-success size-5" /></button>
                    <span className="text-muted-foreground w-20 shrink-0 text-xs">Yours</span>
                    <span className="text-muted-foreground text-sm line-through">{c.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add() }} placeholder="Add something for this week" className="h-8" data-testid="home-ck-add" />
          <Button size="sm" variant="outline" onClick={add}><Plus /> Add</Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline" onClick={() => go(`/checklist/month/${mk}`)}>
          <CalendarDays /> {monthLabel(mk)} {todosLeft ? <Badge variant="warning" className="ml-1 tabular-nums">{todosLeft} parent to-do{todosLeft === 1 ? "" : "s"} left</Badge> : <span className="text-muted-foreground font-normal">· parent to-dos ticked</span>}
        </Button>
      </CardFooter>
    </Card>
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
          <CardTitle className="text-2xl font-semibold tracking-tight">Everything the plan expects, ticked off as it happens</CardTitle>
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
          {reviewsFor({ kind: "week", wk }).map((r) => <ReviewCard key={r.id} r={r} />)}
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <div className="flex items-center gap-2 print:hidden">
                <Button size="icon-sm" variant="ghost" disabled={idx <= 0} onClick={() => go(`/checklist/${D.weeks[idx - 1].w}`)} aria-label="Previous week"><ChevronLeft /></Button>
                <Button size="icon-sm" variant="ghost" disabled={idx >= D.weeks.length - 1} onClick={() => go(`/checklist/${D.weeks[idx + 1].w}`)} aria-label="Next week"><ChevronRight /></Button>
                {wk !== cur && <Button size="sm" variant="ghost" onClick={() => go(`/checklist/${cur}`)}>Back to this week</Button>}
              </div>
              <CardTitle className="text-xl">{wk} · {weekLabel(wk)} {wk === cur && <Badge>This week</Badge>}</CardTitle>
              <CardDescription>{fmt(a)} – {fmt(b)} · {wDone} of {wAuto.length} plan tasks done</CardDescription>
              <CardAction><span className="text-2xl font-semibold tabular-nums">{wAuto.length ? Math.round((wDone / wAuto.length) * 100) : 0}%</span></CardAction>
            </CardHeader>
            <CardContent className="px-5"><Progress value={wAuto.length ? (wDone / wAuto.length) * 100 : 0} className="h-1.5" /></CardContent>
          </Card>
          <Grouped items={wItems} listKey={wk} />
          <CustomItems listKey={wk} />
        </TabsContent>

        <TabsContent value="month" className="flex flex-col gap-4">
          {reviewsFor({ kind: "month", m: month }).map((r) => <ReviewCard key={r.id} r={r} />)}
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <div className="flex items-center gap-2 print:hidden">
                <Button size="icon-sm" variant="ghost" onClick={() => go(`/checklist/month/${shiftMonth(month, -1)}`)} aria-label="Previous month"><ChevronLeft /></Button>
                <Button size="icon-sm" variant="ghost" onClick={() => go(`/checklist/month/${shiftMonth(month, 1)}`)} aria-label="Next month"><ChevronRight /></Button>
                {month !== monthKey(iso(new Date())) && <Button size="sm" variant="ghost" onClick={() => go(`/checklist/month/${monthKey(iso(new Date()))}`)}>Back to this month</Button>}
              </div>
              <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="size-5" /> {monthLabel(month)}</CardTitle>
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
