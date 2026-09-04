import * as React from "react"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, Play, RotateCcw, Send, Timer } from "lucide-react"

import { D, LTR, keyOf } from "@/lib/content"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup } from "@/components/ui/radio-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { ActionBar, Choice, Passage, Runner } from "@/pages/runner"

/* ---------- state helpers ---------- */
export function mockState(form) { return Store.s.mocks[form] || { sections: {} } }
export function mockDef(form) { return D.mocks.find((m) => m.id === form) }
export function scoredSections(m) { return m.sections.filter((s) => s.n) }
export function mockSummary(form) {
  const m = mockDef(form), st = mockState(form)
  const secs = scoredSections(m)
  let right = 0, n = 0, done = 0
  for (const s of secs) { const r = (st.sections || {})[s.id]; if (r && r.submittedAt) { done++; right += r.right || 0; n += s.n } }
  const essayDone = !!(st.essay && st.essay.submittedAt)
  const complete = done === secs.length && essayDone
  const started = done > 0 || essayDone || Object.values(st.sections || {}).some((r) => r && r.started)
  return { right, n, done, total: secs.length, essayDone, complete, started, finishedAt: st.finishedAt }
}
function fmt(ms) { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "" }

/* ---------- list ---------- */
export function MockList() {
  useStore()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-3">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><Timer className="size-4" /> Mock exams</CardDescription>
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight">Four full-length Lower Level forms, timed like the real day</CardTitle>
          <CardDescription>{D.calendar.level.order}. Use only the allowed time; the timer keeps running if the page is closed. Answers and notes unlock when the whole form is finished.</CardDescription>
        </CardHeader>
      </Card>
      <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
        {D.mocks.map((m) => {
          const s = mockSummary(m.id)
          return (
            <Card key={m.id} className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle>{m.name}</CardTitle>
                <CardDescription>{m.blurb}</CardDescription>
                <CardAction>
                  {s.complete ? <Badge variant="success" className="tabular-nums">{s.right}/{s.n}</Badge> : s.started ? <Badge variant="warning">{s.done}/{s.total} sections</Badge> : <Badge variant="outline">{m.label}</Badge>}
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center gap-3 px-5">
                <Button size="sm" onClick={() => go("/mock/" + m.id)} data-testid={`mock-open-${m.id}`}>{s.complete ? "Results" : s.started ? "Continue" : "Open"} <ChevronRight /></Button>
                <span className="text-muted-foreground text-xs">Scheduled {m.label}</span>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- overview / results ---------- */
export function MockOverview({ form }) {
  useStore()
  const m = mockDef(form)
  if (!m) return null
  const st = mockState(form)
  const sum = mockSummary(form)
  const parts = m.split ? ["A", "B"] : [null]

  function reset() {
    if (!confirm(`Clear every section of ${m.name} and start again? The current attempt is discarded.`)) return
    Store.setSlice("mocks", form, () => ({ sections: {} }))
  }

  const rows = m.sections.map((s) => {
    const r = (st.sections || {})[s.id] || {}
    const isBreak = s.id.startsWith("BREAK"), isEssay = s.id === "ESSAY"
    const er = st.essay || {}
    const status = isBreak ? "break" : isEssay ? (er.submittedAt ? "done" : er.started ? "live" : "todo") : r.submittedAt ? "done" : r.started ? "live" : "todo"
    return { s, r, er, isBreak, isEssay, status }
  })
  // the next thing to do, in order
  const next = rows.find((x) => !x.isBreak && x.status !== "done")

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><Timer className="size-4" /> Mock exam · scheduled {m.label}</CardDescription>
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight">{m.name}</CardTitle>
          <CardDescription>{m.blurb}</CardDescription>
          <CardAction>
            {sum.complete ? (
              <div className="text-right">
                <div className="font-serif text-3xl font-semibold tabular-nums">{sum.right}<span className="text-muted-foreground text-base font-normal"> / {sum.n}</span></div>
                <div className="text-muted-foreground text-xs">raw correct</div>
              </div>
            ) : next ? (
              <Button onClick={() => go(`/mock/${form}/${next.s.id}`)} data-testid="mock-next"><Play /> {next.status === "live" ? "Resume" : "Start"} {next.s.name}</Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Progress value={((sum.done + (sum.essayDone ? 1 : 0)) / (sum.total + 1)) * 100} className="h-1.5" />
          <div className="text-muted-foreground text-sm">Before: sleep normally, eat, gather scratch paper, choose a quiet place. During: only the allowed time, no notes, no help. After 24–48 h: classify each miss, reteach, redo.</div>
        </CardContent>
      </Card>

      {parts.map((part) => (
        <Card key={part || "all"} className="gap-2 py-5">
          <CardHeader className="px-5">
            <CardTitle>{part ? `Part ${part}` : "Sections"} <span className="text-muted-foreground font-normal">· {part === "A" ? "VR + QR (one sitting)" : part === "B" ? "RC + MA + Essay (second sitting)" : "in order, one sitting"}</span></CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <ul className="flex flex-col">
              {rows.filter((x) => !part || x.s.part === part).map(({ s, r, er, isBreak, isEssay, status }) => (
                <li key={s.id} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", isBreak && "text-muted-foreground")}>
                  <span className={cn("bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold", status === "done" && "bg-success-soft text-success", status === "live" && "bg-warning-soft text-warning")}>
                    {isBreak ? <Clock className="size-4" /> : status === "done" ? <CheckCircle2 className="size-4" /> : s.id}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground text-xs">{s.n ? `${s.n} questions · ` : ""}{s.min} min{status === "done" && !isEssay ? ` · used ${fmt(r.timeUsed || 0)}` : ""}{status === "done" && isEssay ? ` · ${(er.text || "").trim().split(/\s+/).filter(Boolean).length} words` : ""}</span>
                  </span>
                  {isBreak ? null : status === "done" ? (
                    isEssay ? <Badge variant="success">Written</Badge> : <Badge variant={r.right / s.n >= 0.75 ? "success" : r.right / s.n >= 0.5 ? "warning" : "destructive"} className="tabular-nums">{r.right}/{s.n}</Badge>
                  ) : (
                    <Button size="sm" variant={status === "live" ? "default" : "outline"} onClick={() => go(`/mock/${form}/${s.id}`)} data-testid={`mock-sec-${s.id}`}>{status === "live" ? "Resume" : "Start"}</Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {sum.complete && <MockResults form={form} />}

      {sum.started && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}><RotateCcw /> Start this form over</Button>
        </div>
      )}
    </div>
  )
}

function MockResults({ form }) {
  const m = mockDef(form), st = mockState(form)
  const secs = scoredSections(m)
  const misses = []
  for (const s of secs) {
    const r = (st.sections || {})[s.id] || {}
    D.mockItems[form][s.id].forEach((q, i) => { if ((r.picks || {})[i] !== keyOf(q)) misses.push({ sec: s, q, i, pick: (r.picks || {})[i] || null }) })
  }
  return (
    <>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Raw correct per section. Within 24–48 hours, classify every miss: concept, process, misread, timing, guess, or other.</CardDescription>
          <CardAction>
            {misses.length ? <Button size="sm" onClick={() => go(`/mock/${form}/corrections`)} data-testid="mock-corrections"><RotateCcw /> Corrections drill · {misses.length}</Button> : null}
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Section</TableHead><TableHead className="text-right">Raw</TableHead><TableHead className="text-right">Percent</TableHead><TableHead className="hidden text-right @md/main:table-cell">Time used</TableHead><TableHead className="hidden text-right @md/main:table-cell">Blank</TableHead></TableRow></TableHeader>
            <TableBody>
              {secs.map((s) => {
                const r = (st.sections || {})[s.id] || {}
                const blank = s.n - Object.keys(r.picks || {}).length
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.right}/{s.n}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round((r.right / s.n) * 100)}%</TableCell>
                    <TableCell className="hidden text-right tabular-nums @md/main:table-cell">{fmt(r.timeUsed || 0)} / {s.min}:00</TableCell>
                    <TableCell className="hidden text-right tabular-nums @md/main:table-cell">{blank}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <h2 className="mt-2 font-serif text-xl font-semibold">Missed questions · {misses.length}</h2>
      <div className="flex flex-col gap-3">
        {misses.map(({ sec, q, i, pick }) => (
          <Card key={q.id} className="gap-3 border-destructive/40 py-5">
            <CardHeader className="px-5">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">{pick ? "Missed" : "Blank"}</Badge>
                <span className="text-muted-foreground text-xs">{sec.id} · Q{i + 1}{q.sk ? " · " + q.sk : ""}</span>
              </div>
              <CardTitle className="text-[15px] leading-snug font-medium">{q.q}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-5 text-sm">
              <div className="text-muted-foreground">Your answer: <span className="text-foreground font-medium">{pick ? `${pick}. ${q.c[LTR.indexOf(pick)]}` : "—"}</span></div>
              <div className="text-muted-foreground">Correct: <span className="text-foreground font-medium">{keyOf(q)}. {q.c[LTR.indexOf(keyOf(q))]}</span></div>
              {q.e ? <div className="bg-muted/60 text-muted-foreground rounded-md p-3 leading-relaxed">{q.e}</div> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}

/* ---------- timed section ---------- */
function useClock(endsAt) {
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => { if (!endsAt) return; const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id) }, [endsAt])
  return endsAt ? Math.max(0, endsAt - now) : null
}

export function MockSection({ form, sec }) {
  useStore()
  const m = mockDef(form)
  const def = m && m.sections.find((s) => s.id === sec)
  const items = def && def.n ? D.mockItems[form][sec] : null
  const st = mockState(form)
  const r = (st.sections || {})[sec] || {}
  const [i, setI] = React.useState(0)
  const [showPalette, setPalette] = React.useState(false)
  const left = useClock(r.submittedAt ? null : r.endsAt)

  const save = React.useCallback((patch) => {
    Store.setSlice("mocks", form, (cur) => ({ ...cur, sections: { ...(cur.sections || {}), [sec]: { ...((cur.sections || {})[sec] || {}), ...patch } } }))
  }, [form, sec])

  const submit = React.useCallback((auto) => {
    const cur = (mockState(form).sections || {})[sec] || {}
    if (cur.submittedAt) return
    let right = 0
    items.forEach((q, j) => { if ((cur.picks || {})[j] === keyOf(q)) right++ })
    const timeUsed = Math.min(def.min * 60000, Date.now() - (cur.started || Date.now()))
    save({ submittedAt: new Date().toISOString(), right, n: items.length, timeUsed, autoSubmitted: !!auto })
    // whole form done?
    const s2 = mockSummary(form)
    if (s2.complete) Store.setSlice("mocks", form, (c) => ({ ...c, finishedAt: new Date().toISOString() }))
    window.scrollTo(0, 0)
  }, [form, sec, items, def, save])

  React.useEffect(() => { if (left === 0 && r.started && !r.submittedAt) submit(true) }, [left, r.started, r.submittedAt, submit])

  if (!def) return null
  if (!items) return null

  function start() { const now = Date.now(); save({ started: now, endsAt: now + def.min * 60000, picks: {}, flags: {} }) }
  function pick(letter) { save({ picks: { ...(r.picks || {}), [i]: letter } }) }
  function flag() { save({ flags: { ...(r.flags || {}), [i]: !(r.flags || {})[i] } }) }

  const answered = Object.keys(r.picks || {}).length
  const nextTodo = (() => { const rows = m.sections.filter((s) => !s.id.startsWith("BREAK")); const k = rows.findIndex((s) => s.id === sec); return rows[k + 1] })()

  // not started yet
  if (!r.started) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
          <CardHeader>
            <CardDescription>{m.name} · Section</CardDescription>
            <CardTitle className="font-serif text-2xl font-semibold">{def.name}</CardTitle>
            <CardDescription>{def.n} questions · {def.min} minutes. The clock starts when you press Start and does not pause. When it reaches zero the section submits itself. Unanswered questions count as wrong, so answer every one.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={start} data-testid="mock-start"><Play /> Start {def.name}</Button>
            <Button variant="outline" onClick={() => go("/mock/" + form)}>Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // submitted
  if (r.submittedAt) {
    const pct = Math.round((r.right / items.length) * 100)
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="from-primary/5 to-card bg-gradient-to-t items-center text-center" data-testid="mock-score">
          <CardHeader className="w-full">
            <CardDescription>{m.name} · {def.name}{r.autoSubmitted ? " · time ran out" : ""}</CardDescription>
            <CardTitle className="font-serif text-5xl font-semibold tabular-nums">{r.right}<span className="text-muted-foreground text-xl font-normal"> / {items.length}</span></CardTitle>
            <CardDescription className="text-base">{pct}% · time used {fmt(r.timeUsed || 0)} of {def.min}:00 · {items.length - Object.keys(r.picks || {}).length} left blank</CardDescription>
            <CardDescription className="text-xs">Which questions were missed, and why, unlocks when the whole form is finished.</CardDescription>
          </CardHeader>
        </Card>
        <ActionBar>
          <Button variant="outline" onClick={() => go("/mock/" + form)}>Overview</Button>
          <span className="flex-1" />
          {nextTodo ? <Button onClick={() => go(`/mock/${form}/${nextTodo.id}`)}>{nextTodo.id === "ESSAY" ? "Essay" : "Next: " + nextTodo.name} <ChevronRight /></Button> : <Button onClick={() => go("/mock/" + form)}>See results</Button>}
        </ActionBar>
      </div>
    )
  }

  const q = items[i]
  const warn = left != null && left < 120000
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground font-medium">{m.name} · {def.name}</span>
          <span className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono font-semibold tabular-nums", warn && "border-destructive text-destructive")} data-testid="mock-timer"><Clock className="size-3.5" /> {fmt(left ?? def.min * 60000)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={(answered / items.length) * 100} className="h-1.5" />
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{answered}/{items.length} answered</span>
        </div>
      </div>

      <Card className="gap-5">
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs tabular-nums">Question {i + 1} of {items.length}{q.sk ? ` · ${q.sk}` : ""}</span>
            <Button size="sm" variant={(r.flags || {})[i] ? "secondary" : "ghost"} onClick={flag}><Flag className={cn((r.flags || {})[i] && "fill-current")} /> {(r.flags || {})[i] ? "Flagged" : "Flag"}</Button>
          </div>
          {q.p ? <Passage id={q.p} /> : null}
          <p className="text-lg leading-snug font-medium" data-testid="question">{q.q}</p>
          <RadioGroup value={(r.picks || {})[i] || ""} onValueChange={pick} className="gap-2.5" aria-label="Answer choices">
            {q.c.map((c, k) => <Choice key={k} k={k} text={c} onSelect={(kk) => pick(LTR[kk])} />)}
          </RadioGroup>
        </CardContent>
      </Card>

      {showPalette && (
        <Card className="py-4">
          <CardContent className="flex flex-wrap gap-1.5">
            {items.map((_, j) => (
              <button key={j} type="button" onClick={() => { setI(j); window.scrollTo(0, 0) }}
                className={cn("size-8 rounded-md border text-xs font-semibold tabular-nums", j === i && "ring-ring/50 ring-[3px]", (r.picks || {})[j] ? "bg-primary text-primary-foreground border-primary" : "bg-card", (r.flags || {})[j] && "border-warning border-2")}>
                {j + 1}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <Button variant="outline" onClick={() => { setI(Math.max(0, i - 1)); window.scrollTo(0, 0) }} disabled={i === 0}><ChevronLeft /> Back</Button>
        <Button variant="ghost" size="sm" onClick={() => setPalette((p) => !p)}>{showPalette ? "Hide" : "All questions"}</Button>
        <span className="flex-1" />
        {i < items.length - 1 ? (
          <Button onClick={() => { setI(i + 1); window.scrollTo(0, 0) }} data-testid="mock-next-q">Next <ChevronRight /></Button>
        ) : (
          <Button onClick={() => { if (answered < items.length && !confirm(`${items.length - answered} question(s) are blank. Submit anyway?`)) return; submit(false) }} data-testid="mock-submit"><Send /> Submit section</Button>
        )}
      </ActionBar>
    </div>
  )
}

/* ---------- essay ---------- */
export function MockEssay({ form }) {
  useStore()
  const m = mockDef(form)
  const def = m && m.sections.find((s) => s.id === "ESSAY")
  const st = mockState(form)
  const er = st.essay || {}
  const [text, setText] = React.useState(er.text || "")
  const t = React.useRef(null)
  const left = useClock(er.submittedAt ? null : er.endsAt)
  const save = React.useCallback((patch) => Store.setSlice("mocks", form, (cur) => ({ ...cur, essay: { ...(cur.essay || {}), ...patch } })), [form])
  const submit = React.useCallback((auto) => {
    const cur = mockState(form).essay || {}
    if (cur.submittedAt) return
    save({ submittedAt: new Date().toISOString(), text: text || cur.text || "", autoSubmitted: !!auto })
    if (mockSummary(form).complete) Store.setSlice("mocks", form, (c) => ({ ...c, finishedAt: new Date().toISOString() }))
    window.scrollTo(0, 0)
  }, [form, save, text])
  React.useEffect(() => { if (left === 0 && er.started && !er.submittedAt) submit(true) }, [left, er.started, er.submittedAt, submit])
  if (!def) return null
  const wc = (text.trim().match(/\S+/g) || []).length

  if (!er.started) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
          <CardHeader>
            <CardDescription>{m.name} · Essay</CardDescription>
            <CardTitle className="font-serif text-2xl font-semibold">30-minute essay</CardTitle>
            <CardDescription>The prompt is unseen until you press Start. Plan briefly, write for the full time, and keep this timed version as it is. Schools see the essay; it is not scored.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => { const now = Date.now(); save({ started: now, endsAt: now + def.min * 60000 }) }} data-testid="mock-essay-start"><Play /> Start essay</Button>
            <Button variant="outline" onClick={() => go("/mock/" + form)}>Back</Button>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (er.submittedAt) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="gap-4">
          <CardHeader>
            <CardDescription>{m.name} · Essay · submitted {fmtDate(er.submittedAt)}{er.autoSubmitted ? " · time ran out" : ""}</CardDescription>
            <CardTitle className="font-serif text-lg leading-snug">{def.prompt}</CardTitle>
            <CardAction><Badge variant="success" className="tabular-nums">{(er.text || "").trim().split(/\s+/).filter(Boolean).length} words</Badge></CardAction>
          </CardHeader>
          <CardContent className="text-[15px] leading-7 whitespace-pre-wrap">{er.text}</CardContent>
        </Card>
        <ActionBar>
          <Button variant="outline" onClick={() => go("/mock/" + form)}>Overview</Button>
          <span className="flex-1" />
          <Button onClick={() => go("/mock/" + form)}>See results</Button>
        </ActionBar>
      </div>
    )
  }
  const warn = left != null && left < 180000
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground font-medium">{m.name} · Essay</span>
        <span className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono font-semibold tabular-nums", warn && "border-destructive text-destructive")}><Clock className="size-3.5" /> {fmt(left ?? def.min * 60000)}</span>
      </div>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="font-serif text-lg leading-snug" data-testid="mock-essay-prompt">{def.prompt}</CardTitle>
          <CardDescription>Plan briefly at the top, then write. Autosaves as you type.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={text} onChange={(e) => { const v = e.target.value; setText(v); clearTimeout(t.current); t.current = setTimeout(() => save({ text: v }), 600) }} onBlur={() => { clearTimeout(t.current); save({ text }) }} className="min-h-[50vh] text-[15px] leading-7" placeholder="Start writing…" data-testid="mock-essay-text" />
          <div className="text-muted-foreground mt-2 text-right text-xs tabular-nums">{wc} words</div>
        </CardContent>
      </Card>
      <ActionBar>
        <span className="text-muted-foreground text-sm"><AlertTriangle className="mr-1 inline size-3.5" /> Submitting ends the essay.</span>
        <span className="flex-1" />
        <Button onClick={() => { if (confirm("Submit the essay now?")) submit(false) }} data-testid="mock-essay-submit"><Send /> Submit essay</Button>
      </ActionBar>
    </div>
  )
}

/* ---------- corrections drill (does not change the recorded score) ---------- */
export function MockCorrections({ form }) {
  const m = mockDef(form), st = mockState(form)
  const items = []
  for (const s of scoredSections(m)) {
    const r = (st.sections || {})[s.id] || {}
    D.mockItems[form][s.id].forEach((q, i) => { if ((r.picks || {})[i] !== keyOf(q)) items.push(q) })
  }
  if (!items.length) return <MockOverview form={form} />
  return <Runner key={`corr:${form}:${items.length}`} items={items} custom record={false} title={`${m.name} · Corrections`} exitPath={"/mock/" + form} exitLabel="Back to results" />
}
