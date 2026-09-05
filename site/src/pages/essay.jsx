import * as React from "react"
import { BookOpen, CheckCircle2, ChevronRight, Clock, MessageSquareText, PenLine, Play, RotateCcw, Square } from "lucide-react"

import { D, currentWeek, weekLabel } from "@/lib/content"
import { isSeen, reviewsFor } from "@/lib/reviews"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { ReviewCard } from "@/components/review-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

/* ---------- state helpers ---------- */
export function essayState(wk) { return Store.s.essays[wk] || {} }
export function essayStatus(wk) {
  const e = essayState(wk)
  if (e.completedAt) return "complete"
  const draft = e.draft || {}
  if (Object.values(draft).some((t) => t && t.trim()) || Object.values(e.plan || {}).some((t) => t && t.trim())) return "in progress"
  return "not started"
}
function words(t) { return (t || "").trim() ? (t.trim().match(/\S+/g) || []).length : 0 }

/* ---------- time log ---------- */
/** The three phases of the thirty-minute session, with their target minutes. */
export const PHASES = [["plan", "Plan", 5], ["draft", "Draft", 20], ["revise", "Revise", 5]]
export const TARGET_MINUTES = PHASES.reduce((n, [, , m]) => n + m, 0)
/** "19", 19.4, "" → whole minutes or null. Anything that is not a sensible number is null. */
function toMinutes(v) {
  if (v === "" || v == null) return null
  const n = Math.round(+v)
  return Number.isFinite(n) && n >= 0 && n <= 240 ? n : null
}
/** Minutes logged for each phase of one week, plus the total (null when nothing is logged).
 *  The first site version kept a free-text "time at draft stop" in meta.minutes; it still
 *  counts as the draft time until she overwrites it, so nothing she typed is lost. */
export function essayTime(wk) {
  const st = essayState(wk), t = st.time || {}
  const out = {}
  for (const [k] of PHASES) out[k] = toMinutes(t[k])
  if (out.draft == null) out.draft = toMinutes(((st.meta || {}).minutes || "").toString().replace(/[^\d.]/g, ""))
  const logged = PHASES.map(([k]) => out[k]).filter((m) => m != null)
  out.total = logged.length ? logged.reduce((a, b) => a + b, 0) : null
  return out
}
export function setEssayTime(wk, phase, minutes) {
  Store.setSlice("essays", wk, (cur) => ({ ...cur, time: { ...(cur.time || {}), [phase]: toMinutes(minutes) } }))
}

/** One phase's minutes, typed by hand. Saves on every keystroke; the numbers are tiny. */
function MinutesInput({ wk, phase, label, target }) {
  const stored = essayTime(wk)[phase]
  const [v, setV] = React.useState(stored == null ? "" : String(stored))
  React.useEffect(() => { setV(stored == null ? "" : String(stored)) }, [stored])
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`${wk}-time-${phase}`} className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label} <span className="font-normal normal-case">· target {target}</span></Label>
      <div className="flex items-center gap-1.5">
        <Input id={`${wk}-time-${phase}`} type="number" inputMode="numeric" min={0} max={240} step={1} value={v} placeholder={String(target)}
          onChange={(e) => { const val = e.target.value; setV(val); setEssayTime(wk, phase, val) }}
          className="w-20 tabular-nums" data-testid={`essay-time-${phase}`} />
        <span className="text-muted-foreground text-sm">min</span>
      </div>
    </div>
  )
}

/** Where she writes down how long each phase really took — by hand, or from the phase timer's
 *  Stop button. Works just as well for an essay written on paper at the kitchen table. */
function TimeLog({ wk }) {
  const t = essayTime(wk)
  const over = t.total != null && t.total > TARGET_MINUTES
  return (
    <Card className="gap-3 py-5" data-testid="essay-time-log">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4" /> Time log</CardTitle>
        <CardDescription>How long each phase really took, in minutes. Type it in, or press Stop on a phase timer and it lands here.</CardDescription>
        <CardAction>
          <Badge variant={t.total == null ? "outline" : over ? "warning" : "secondary"} className="tabular-nums" data-testid="essay-time-total">
            {t.total == null ? "not logged" : `${t.total} of ${TARGET_MINUTES} min`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-4 px-5">
        {PHASES.map(([k, label, target]) => <MinutesInput key={k} wk={wk} phase={k} label={label} target={target} />)}
        {over ? <span className="text-muted-foreground pb-2 text-xs">Over thirty minutes is fine while practising; the real test stops the clock.</span> : null}
      </CardContent>
    </Card>
  )
}

/** Debounced textarea bound to one field of one essay week. */
function Field({ wk, group, name, label, placeholder, rows = 3, multiline = true }) {
  const st = essayState(wk)
  const stored = ((st[group] || {})[name]) || ""
  const [v, setV] = React.useState(stored)
  const t = React.useRef(null)
  React.useEffect(() => { setV(stored) }, [stored])
  function save(val) {
    Store.setSlice("essays", wk, (cur) => ({ ...cur, [group]: { ...(cur[group] || {}), [name]: val } }))
  }
  function onChange(e) { const val = e.target.value; setV(val); clearTimeout(t.current); t.current = setTimeout(() => save(val), 500) }
  const Comp = multiline ? Textarea : Input
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${wk}-${group}-${name}`} className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</Label>
      <Comp id={`${wk}-${group}-${name}`} value={v} onChange={onChange} onBlur={() => { clearTimeout(t.current); if (v !== stored) save(v) }} placeholder={placeholder} rows={rows} className={multiline ? "min-h-20" : ""} />
    </div>
  )
}

/** Simple count-down for one phase; runs off the clock so a background tab keeps it honest.
 *  Stop writes the minutes actually used into the week's time log; Reset throws them away. */
function PhaseTimer({ minutes, label, onStop }) {
  const [startedAt, setStarted] = React.useState(null)
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => { if (!startedAt) return; setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(id) }, [startedAt])
  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0
  const left = Math.max(0, minutes * 60000 - elapsed)
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000)
  const over = startedAt && left === 0
  function stop() { onStop(Math.max(1, Math.round(elapsed / 60000))); setStarted(null) }
  return (
    <div className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm", over && "border-destructive text-destructive")}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-mono font-semibold tabular-nums">{mm}:{String(ss).padStart(2, "0")}</span>
      {startedAt ? (
        <>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={stop} title="Stop and log the time used" data-testid={`timer-stop-${label.toLowerCase()}`}><Square /> Stop</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setStarted(null)} title="Reset without logging"><RotateCcw /></Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setStarted(Date.now())} data-testid={`timer-start-${label.toLowerCase()}`}><Play /> Start</Button>
      )}
    </div>
  )
}

function Rating({ value, onChange, max = 4 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <Button key={n} size="sm" variant={value === n ? "default" : "outline"} className="size-8 p-0 tabular-nums" onClick={() => onChange(n)}>{n}</Button>
      ))}
    </div>
  )
}

/* ---------- list ---------- */
export function EssayList() {
  useStore()
  const cur = currentWeek()
  const weeks = D.weeks.map((w) => ({ ...w, e: D.essay.weeks[w.w] }))
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-3">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><PenLine className="size-4" /> Essay</CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-tight">One prompt a week, thirty minutes</CardTitle>
          <CardDescription>{D.essay.home.target}</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">{D.essay.home.structure} · {D.essay.home.goal}</CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
        {weeks.map(({ w, label, e }) => {
          const status = essayStatus(w)
          const t = essayTime(w)
          const reviews = reviewsFor({ kind: "essay", wk: w })
          const unread = reviews.some((r) => !isSeen(r.id))
          return (
            <Card key={w} className={cn("gap-3 py-5", w === cur && "border-primary/50 ring-primary/15 ring-2")}>
              <CardHeader className="px-5">
                <CardTitle className="flex items-center gap-2">{w} <span className="text-muted-foreground font-normal">· {label}</span>{w === cur && <Badge>This week</Badge>}</CardTitle>
                <CardDescription>{e.focus}</CardDescription>
                <CardAction className="flex flex-col items-end gap-1">
                  <Badge variant={status === "complete" ? "success" : status === "in progress" ? "warning" : "outline"}>{status}</Badge>
                  {reviews.length ? <Badge variant="secondary" data-testid={`essay-reviewed-${w}`} data-unread={unread ? "1" : "0"}>{unread ? <span className="bg-primary size-2 rounded-full" /> : null} Reviewed</Badge> : null}
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 px-5">
                <p className="text-[15px] leading-snug">{e.prompt}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={() => go("/essay/" + w)} data-testid={`essay-open-${w}`}>{status === "not started" ? "Start" : "Open"} <ChevronRight /></Button>
                  {t.total != null ? <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums" data-testid={`essay-time-${w}`}><Clock className="size-3.5" /> {t.total} min logged</span> : null}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- workspace ---------- */
export function EssayWeek({ wk }) {
  useStore()
  const e = D.essay.weeks[wk]
  if (!e) return null
  const st = essayState(wk)
  const status = essayStatus(wk)
  const draftWords = ["opening", "middle", "ending"].reduce((n, k) => n + words((st.draft || {})[k]), 0)
  const bank = D.essay.bank.filter((b) => (e.alternate || "").includes(b.id))
  const reviews = reviewsFor({ kind: "essay", wk })
  const [tab, setTab] = React.useState(status === "complete" ? "feedback" : "plan")

  function setFeedback(check, patch) {
    Store.setSlice("essays", wk, (cur) => ({ ...cur, feedback: { ...(cur.feedback || {}), [check]: { ...((cur.feedback || {})[check] || {}), ...patch } } }))
  }
  function setRubric(dim, val) {
    Store.setSlice("essays", wk, (cur) => ({ ...cur, rubric: { ...(cur.rubric || {}), [dim]: val } }))
  }
  function complete() { Store.setSlice("essays", wk, (cur) => ({ ...cur, completedAt: new Date().toISOString() })); window.scrollTo(0, 0) }
  function reopen() { Store.setSlice("essays", wk, (cur) => ({ ...cur, completedAt: null })) }

  const planFields = [
    ["type", "Prompt type / action word", "e.g. describe · explain · persuade"],
    ["restate", "Plain-language restatement", "The prompt is asking me to …"],
    ["ideas", "Three possible ideas or claims", "1. …  2. …  3. …"],
    ["focus", "Chosen focus", "I will show / explain / argue that …"],
    ["map", "Three-part map", "Opening/setup → evidence/event/reason → insight/result"],
    ["details", "Details to include", "Person / place / action / words / thought"],
  ]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-3">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><PenLine className="size-4" /> Essay · {wk} · {weekLabel(wk)}</CardDescription>
          <CardTitle className="text-xl leading-snug font-semibold" data-testid="essay-prompt">{e.prompt}</CardTitle>
          <CardDescription>Week focus: {e.focus}</CardDescription>
          <CardAction className="flex flex-col items-end gap-1">
            {status === "complete" ? <Badge variant="success"><CheckCircle2 /> Complete</Badge> : <Badge variant="secondary" className="tabular-nums">{draftWords} words</Badge>}
            {reviews.length ? <Badge variant="outline"><MessageSquareText /> {reviews.length === 1 ? "Reviewed" : `${reviews.length} reviews`}</Badge> : null}
          </CardAction>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">{e.target}</CardContent>
      </Card>

      {/* A review sits above the phases, whatever tab she is on: someone wrote it for her,
          and it may arrive from Drive after the page is already open. */}
      {reviews.map((r) => <ReviewCard key={r.id} r={r} changedAt={st.at} />)}

      <TimeLog wk={wk} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="plan">Plan · 5</TabsTrigger>
          <TabsTrigger value="draft">Draft · 20</TabsTrigger>
          <TabsTrigger value="feedback">Revise · 5</TabsTrigger>
          <TabsTrigger value="guide"><BookOpen /> Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="plan">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Phase 1 — Plan</CardTitle>
              <CardDescription>Target: 5 minutes. Read the prompt precisely, generate options, choose one focus.</CardDescription>
              <CardAction><PhaseTimer minutes={5} label="Plan" onStop={(m) => setEssayTime(wk, "plan", m)} /></CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {planFields.map(([name, label, ph]) => <Field key={name} wk={wk} group="plan" name={name} label={label} placeholder={ph} rows={2} />)}
              {bank.length ? (
                <div className="bg-muted/60 rounded-md p-3 text-sm">
                  <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">Optional alternate prompt</div>
                  {bank.map((b) => <p key={b.id} className="leading-relaxed"><span className="font-medium">{b.id} · {b.type}:</span> {b.prompt} <span className="text-muted-foreground">Lens: {b.lens}</span></p>)}
                </div>
              ) : null}
              <div><Button onClick={() => setTab("draft")}>Go to draft <ChevronRight /></Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="draft">
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>Phase 2 — First draft</CardTitle>
              <CardDescription>Target: 20 minutes. Keep this draft as it is when time ends; revise separately.</CardDescription>
              <CardAction><PhaseTimer minutes={20} label="Draft" onStop={(m) => setEssayTime(wk, "draft", m)} /></CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field wk={wk} group="draft" name="opening" label="Opening and focus" placeholder="Answer the prompt and set up the experience or claim…" rows={5} />
              <Field wk={wk} group="draft" name="middle" label="Middle — evidence, event, or reasons" placeholder="What happened, what you thought, what you did — with specific details…" rows={8} />
              <Field wk={wk} group="draft" name="ending" label="Ending — reflection or final implication" placeholder="Explain the lesson and connect it back to the prompt…" rows={4} />
              <div className="text-muted-foreground text-sm tabular-nums">{draftWords} words</div>
              <div><Button onClick={() => setTab("feedback")}>Go to revise <ChevronRight /></Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <div className="flex flex-col gap-4">
            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Phase 3 — Feedback and revision</CardTitle>
                <CardDescription>Target: 5 minutes. Self-check first; an adult or peer can add to it.</CardDescription>
                <CardAction><PhaseTimer minutes={5} label="Revise" onStop={(m) => setEssayTime(wk, "revise", m)} /></CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {e.feedback_checks.map((check) => {
                  const f = (st.feedback || {})[check] || {}
                  return (
                    <div key={check} className="flex flex-col gap-2 rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{check}</span>
                        <Rating value={f.rating} onChange={(n) => setFeedback(check, { rating: n })} />
                      </div>
                      <Input value={f.note || ""} onChange={(ev) => setFeedback(check, { note: ev.target.value })} placeholder="Evidence from the draft, and one precise suggestion" />
                    </div>
                  )
                })}
                <Field wk={wk} group="meta" name="worked" label="What worked" placeholder="One thing to keep doing" rows={2} />
                <Field wk={wk} group="meta" name="next" label="Next improvement" placeholder="One change for next week" rows={2} />
                <div className="text-muted-foreground text-xs">{D.essay.guide.revision_order}</div>
                <div className="flex gap-2">
                  {status === "complete" ? (
                    <Button variant="secondary" onClick={reopen}><RotateCcw /> Reopen</Button>
                  ) : (
                    <Button onClick={complete} disabled={draftWords < 40} data-testid="essay-complete"><CheckCircle2 /> Mark this week complete</Button>
                  )}
                  {draftWords < 40 && status !== "complete" && <span className="text-muted-foreground self-center text-xs">Write at least a short draft first.</span>}
                </div>
              </CardContent>
            </Card>

            <Card className="gap-4">
              <CardHeader>
                <CardTitle>Growth rubric</CardTitle>
                <CardDescription>Rate the current level 1–4 in each dimension; the matching next step appears.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {D.essay.rubric.dimensions.map((dim, i) => {
                  const v = (st.rubric || {})[dim.name]
                  const step = D.essay.rubric.next_steps[i]
                  return (
                    <div key={dim.name} className="flex flex-col gap-2 rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{dim.name}</span>
                        <Rating value={v} onChange={(n) => setRubric(dim.name, n)} />
                      </div>
                      <div className="text-muted-foreground text-xs">{v ? `${v} — ${dim.levels[v - 1]}` : dim.levels.map((l, k) => `${k + 1} ${l}`).join(" · ")}</div>
                      {v && step ? <div className="bg-accent text-accent-foreground rounded-md px-3 py-2 text-sm">Next step: {step.steps[v - 1]}</div> : null}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="guide">
          <div className="flex flex-col gap-4">
            <Card className="gap-4">
              <CardHeader><CardTitle>Eight short lessons</CardTitle><CardDescription>{D.essay.guide.target}</CardDescription></CardHeader>
              <CardContent className="flex flex-col divide-y">
                {D.essay.guide.lessons.map((l) => (
                  <div key={l.title} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="font-medium">{l.title} <span className="text-muted-foreground font-normal">— {l.objective}</span></div>
                    <p className="text-sm leading-relaxed">{l.teach}</p>
                    <p className="text-muted-foreground text-sm"><span className="font-medium">Try:</span> {l.try}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="gap-4">
              <CardHeader><CardTitle>Model excerpts</CardTitle><CardDescription>Short, original, and not tied to this week's prompt.</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {D.essay.guide.excerpts.map((x) => (
                  <div key={x.label} className="rounded-md border p-3">
                    <div className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">{x.label}</div>
                    <p className="text-sm leading-relaxed italic">{x.text}</p>
                    <p className="text-muted-foreground mt-1 text-sm">{x.why}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="gap-4">
              <CardHeader><CardTitle>Sentence and transition supports</CardTitle><CardDescription>Adapt them to your own meaning.</CardDescription></CardHeader>
              <CardContent className="flex flex-col divide-y">
                {D.essay.guide.supports.map((s) => (
                  <div key={s.move} className="flex flex-col gap-0.5 py-2 text-sm first:pt-0 last:pb-0 sm:flex-row sm:gap-3">
                    <span className="w-40 shrink-0 font-medium">{s.move}</span>
                    <span className="text-muted-foreground">{s.frames}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
