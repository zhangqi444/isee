import * as React from "react"
import { ArrowLeft, ArrowRight, Award, Check, CheckCircle2, Gauge, Home, RotateCcw, Timer, XCircle } from "lucide-react"

import { D, LTR, keyOf } from "@/lib/content"
import { BUDGET, CAUSES, findItem, paceFlag, rec, recordAttempts, setTag } from "@/lib/engine"
import { syncBadges } from "@/lib/rewards"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupPrimitive } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const { useState, useEffect, useRef } = React

export function Passage({ id }) {
  const p = D.passages[id]
  if (!p) return null
  return (
    <ScrollArea className="bg-muted/40 max-h-64 rounded-lg border [&>[data-radix-scroll-area-viewport]]:max-h-64">
      <div className="flex flex-col gap-3 p-4 text-[15px] leading-7">
        {p.t ? <h3 className="font-serif text-base font-semibold">{p.t}</h3> : null}
        {p.x.split(/\n+/).map((para, k) => <p key={k}>{para}</p>)}
      </div>
    </ScrollArea>
  )
}

/** One choice, rendered as a card-sized radio so the whole row is the target. */
export function Choice({ k, text, checked, onSelect }) {
  return (
    <RadioGroupPrimitive.Item
      value={LTR[k]}
      data-testid="choice"
      className={cn(
        "group/opt bg-card hover:bg-accent/50 focus-visible:ring-ring/50 flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left text-[15px] leading-snug shadow-xs transition-colors outline-none focus-visible:ring-[3px]",
        "data-[state=checked]:border-primary data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
      )}
      onClick={() => onSelect(k)}
    >
      <span className="bg-muted text-muted-foreground group-data-[state=checked]/opt:bg-primary group-data-[state=checked]/opt:text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-colors">
        {LTR[k]}
      </span>
      <span className="pt-0.5">{text}</span>
    </RadioGroupPrimitive.Item>
  )
}

export function ActionBar({ children }) {
  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-4 -mb-4 mt-2 flex items-center gap-3 border-t px-4 py-3 backdrop-blur md:-mx-6 md:-mb-6 md:px-6">
      {children}
    </div>
  )
}

/** Reconstruct the pick indices of a finished set from a stored result: the
 *  recorded letters when we have them, otherwise "was right => the key". */
function picksFromResult(items, r) {
  const wrong = new Set(r.wrong || [])
  return items.map((q) => {
    const L = r.picks && r.picks[q.id]
    if (L && LTR.indexOf(L) > -1) return LTR.indexOf(L)
    return wrong.has(q.id) ? null : LTR.indexOf(keyOf(q))
  })
}

const subOf = (q, fallback) => (findItem(q.id) || {}).sub || fallback || "vr"
const fmtSec = (ms) => `${Math.round(ms / 1000)} s`

/** Why did this go wrong? One tap for the cause, one for "were you sure". */
export function CauseTags({ id, compact }) {
  useStore()
  const r = rec(id) || {}
  return (
    <div className={cn("flex flex-col gap-2", compact && "gap-1.5")} data-testid="cause-tags" data-tag={r.tag || ""}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-xs">Why?</span>
        {CAUSES.map((c) => (
          <Tooltip key={c.id}>
            <TooltipTrigger asChild>
              <Button size="sm" variant={r.tag === c.id ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => setTag(id, { tag: r.tag === c.id ? null : c.id })} data-testid={`tag-${c.id}`}>{c.label}</Button>
            </TooltipTrigger>
            <TooltipContent>{c.hint}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground mr-1 text-xs">Were you sure?</span>
        <Button size="sm" variant={r.sure === true ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => setTag(id, { sure: r.sure === true ? null : true })} data-testid="sure-yes">Sure</Button>
        <Button size="sm" variant={r.sure === false ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => setTag(id, { sure: r.sure === false ? null : false })} data-testid="sure-no">Guessing</Button>
      </div>
    </div>
  )
}

/** Seconds on the current question against the section budget; goes amber past it. Pacing mode only. */
function SoftTimer({ since, budget }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const sec = Math.round((now - since) / 1000)
  const over = sec > budget
  return (
    <span className={cn("flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs tabular-nums", over ? "border-warning text-warning" : "text-muted-foreground")} data-testid="soft-timer">
      <Timer className="size-3" /> {sec} s <span className="opacity-60">/ {budget}</span>
    </span>
  )
}

/**
 * items: questions · setId: results key for plan sets · custom: not a plan set (review, mixed, corrections, word quiz)
 * ctx: set | review | mixed | corr | vocab — what kind of evidence the answers are · onFinish(summary): custom flows
 * prior: an earlier result to reopen · record=false: nothing is written (corrections right after a mock).
 */
export function Runner({ items, title, setId, custom, ctx, exitPath, exitLabel, prior, record = true, onFinish, sub: subHint }) {
  const kind = ctx || (custom ? "review" : "set")
  const store = useStore()
  const [i, setI] = useState(0)
  const [picks, setPicks] = useState(() => (prior ? picksFromResult(items, prior) : []))
  const [done, setDone] = useState(() => (prior ? { right: prior.right, at: prior.at, attempts: prior.attempts || 1, reopened: true, times: prior.times || null } : null))
  const [won, setWon] = useState([])           // badges earned by finishing this set
  const spent = useRef({})                    // question index -> ms
  const entered = useRef(Date.now())
  const it = items[i], total = items.length
  const pacing = !!store.s.pacing
  const budget = BUDGET[subOf(it || items[0], subHint)] || 50

  function leave() { spent.current[i] = (spent.current[i] || 0) + (Date.now() - entered.current); entered.current = Date.now() }
  function retry() { setPicks([]); setDone(null); setWon([]); setI(0); spent.current = {}; entered.current = Date.now(); window.scrollTo(0, 0) }

  function choose(k) { const np = picks.slice(); np[i] = k; setPicks(np) }
  function step(d) {
    if (d > 0 && picks[i] == null) return
    if (d > 0 && i === total - 1) return finish()
    leave()
    setI(Math.max(0, i + d)); window.scrollTo(0, 0)
  }
  function finish() {
    leave()
    let right = 0
    const wrong = [], entries = [], times = {}, bySub = {}
    items.forEach((q, j) => {
      const ok = LTR[picks[j]] === keyOf(q)
      if (ok) right++; else wrong.push(q.id)
      const ms = spent.current[j] || 0
      times[q.id] = ms
      entries.push({ id: q.id, ok, ms, pick: picks[j] == null ? null : LTR[picks[j]] })
      const s = subOf(q, subHint); bySub[s] = bySub[s] || { right: 0, n: 0 }; bySub[s].n++; if (ok) bySub[s].right++
    })
    const at = new Date().toISOString()
    if (!custom) {
      const picksById = {}
      items.forEach((q, j) => { if (picks[j] != null) picksById[q.id] = LTR[picks[j]] })
      const res = { n: items.length, right, at, wrong, picks: picksById, times }
      if (prior) {                                   // keep the first attempt on record
        res.attempts = (prior.attempts || 1) + 1
        res.first = prior.first || { right: prior.right, at: prior.at }
      }
      Store.recordSet(setId, res)
    }
    if (record) recordAttempts(entries, kind)
    if (onFinish) onFinish({ right, n: items.length, at, wrong, bySub, times })
    if (record) setWon(syncBadges())
    setDone({ right, at, attempts: prior ? (prior.attempts || 1) + 1 : 1, times })
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    const on = (e) => {
      if (done || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target && e.target.tagName) || ""
      if (tag === "INPUT" || tag === "TEXTAREA") return
      const k = (e.key || "").toUpperCase()
      let idx = LTR.indexOf(k)
      if (idx === -1 && e.key >= "1" && e.key <= "4") idx = +e.key - 1
      if (idx > -1 && it) { choose(idx); e.preventDefault() }
      else if (e.key === "Enter") { step(1); e.preventDefault() }
      else if (e.key === "Backspace") { step(-1); e.preventDefault() }
    }
    addEventListener("keydown", on)
    return () => removeEventListener("keydown", on)
  })

  if (done) {
    const pct = Math.round((done.right / total) * 100)
    const msg = pct >= 85 ? "Strong set. Read the notes on anything you guessed."
      : pct >= 60 ? "Solid. The notes below are where the next few marks are."
      : "This one was hard. Work through the notes slowly — that is what moves the score."
    const when = done.at ? new Date(done.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null
    const noLetters = done.reopened && !(prior && prior.picks)
    const canTag = record && kind !== "corr"
    const misses = items.filter((q, j) => LTR[picks[j]] !== keyOf(q))
    const tagged = canTag ? misses.filter((q) => (rec(q.id) || {}).tag).length : 0
    const timed = done.times ? items.map((q) => done.times[q.id] || 0).filter(Boolean) : []
    const avg = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : null
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="from-primary/5 to-card bg-gradient-to-t items-center text-center" data-testid="score">
          <CardHeader className="w-full">
            <CardDescription>{title}{done.reopened && when ? ` · completed ${when}` : ""}{done.attempts > 1 ? ` · attempt ${done.attempts}` : ""}</CardDescription>
            <CardTitle className="font-serif text-5xl font-semibold tabular-nums">
              {done.right}<span className="text-muted-foreground text-xl font-normal"> / {total}</span>
            </CardTitle>
            <CardDescription className="text-base">{pct}% · {msg}</CardDescription>
            {avg != null && (
              <CardDescription className="flex flex-wrap items-center justify-center gap-x-3 text-xs" data-testid="pace-summary">
                <span><Gauge className="mr-1 inline size-3" />about {Math.round(avg / 1000)} s a question · real-test budget {budget} s</span>
                {avg / 1000 > budget * 1.25 ? <Badge variant="warning">slower than the budget</Badge> : avg / 1000 < budget * 0.5 && pct < 70 ? <Badge variant="destructive">very fast — slow down</Badge> : <Badge variant="success">on pace</Badge>}
              </CardDescription>
            )}
            {canTag && misses.length ? (
              <CardDescription className="text-xs" data-testid="tag-progress">{tagged} of {misses.length} miss{misses.length === 1 ? "" : "es"} tagged — one tap each below says why it went wrong.</CardDescription>
            ) : null}
            {won.length ? (
              <div className="border-primary/40 bg-primary/5 mt-3 flex flex-col items-center gap-1.5 rounded-lg border p-3" data-testid="badges-won">
                <span className="text-primary flex items-center gap-1.5 text-sm font-medium"><Award className="size-4" /> {won.length === 1 ? "New badge" : `${won.length} new badges`}</span>
                <span className="text-sm">{won.map((b) => b.name).join(" · ")}</span>
                <Button size="sm" variant="ghost" onClick={() => go("/rewards")}>See rewards</Button>
              </div>
            ) : null}
            {!custom && (
              <div className="mt-2 flex justify-center">
                <Button variant="outline" size="sm" onClick={retry} data-testid="retry"><RotateCcw /> Try this set again</Button>
              </div>
            )}
            {noLetters && <CardDescription className="text-xs">This set was done before answers were recorded letter by letter, so only right/missed is shown.</CardDescription>}
          </CardHeader>
        </Card>
        <h2 className="mt-2 font-serif text-xl font-semibold">Every question</h2>
        <div className="flex flex-col gap-3">
          {items.map((q, j) => {
            const ok = LTR[picks[j]] === keyOf(q)
            const yours = picks[j] == null ? "—" : `${LTR[picks[j]]}. ${q.c[picks[j]]}`
            const ms = done.times ? done.times[q.id] : 0
            const flag = paceFlag(subOf(q, subHint), ms, ok)
            return (
              <Card key={j} className={cn("gap-3 py-5", !ok && "border-destructive/40")}>
                <CardHeader className="px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {ok ? <Badge variant="success"><CheckCircle2 /> Correct</Badge> : <Badge variant="destructive"><XCircle /> Missed</Badge>}
                    <span className="text-muted-foreground text-xs">Q{j + 1}{q.sk ? " · " + q.sk : ""}</span>
                    {ms ? <span className="text-muted-foreground text-xs tabular-nums">· {fmtSec(ms)}</span> : null}
                    {flag ? <Badge variant={flag.tone} className="text-xs">{flag.label}</Badge> : null}
                  </div>
                  <CardTitle className="text-[15px] leading-snug font-medium">{q.q}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-5 text-sm">
                  <div className="text-muted-foreground">Your answer: <span className="text-foreground font-medium">{yours}</span></div>
                  {!ok && (
                    <div className="text-muted-foreground">Correct: <span className="text-foreground font-medium">{keyOf(q)}. {q.c[LTR.indexOf(keyOf(q))]}</span></div>
                  )}
                  {q.e ? <div className="bg-muted/60 text-muted-foreground rounded-md p-3 leading-relaxed">{q.e}</div> : null}
                  {!ok && canTag ? <CauseTags id={q.id} /> : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
        <ActionBar>
          <Button variant="outline" onClick={() => go("/")}><Home /> Dashboard</Button>
          <span className="flex-1" />
          <Button onClick={() => go(exitPath)}>{exitLabel} <ArrowRight /></Button>
        </ActionBar>
      </div>
    )
  }

  const last = i === total - 1
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-medium">{title}</span>
          <span className="flex shrink-0 items-center gap-2">
            {pacing ? <SoftTimer key={i} since={entered.current} budget={budget} /> : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant={pacing ? "secondary" : "ghost"} className="h-7 px-2 text-xs" onClick={() => Store.setPref("pacing", !pacing)} data-testid="pacing-toggle"><Gauge /> Pacing {pacing ? "on" : "off"}</Button>
              </TooltipTrigger>
              <TooltipContent>Shows a soft timer against the real test's {budget} seconds a question. Nothing auto-advances.</TooltipContent>
            </Tooltip>
            <span className="tabular-nums">{i + 1} / {total}</span>
          </span>
        </div>
        <Progress value={(i / total) * 100} className="h-1.5" aria-label="Progress through the set" />
      </div>
      <Card className="gap-5">
        <CardContent className="flex flex-col gap-5">
          {it.p ? <Passage id={it.p} /> : null}
          <p className="text-lg leading-snug font-medium" data-testid="question">{it.q}</p>
          <RadioGroup value={picks[i] == null ? "" : LTR[picks[i]]} onValueChange={(v) => choose(LTR.indexOf(v))} className="gap-2.5" aria-label="Answer choices">
            {it.c.map((c, k) => <Choice key={k} k={k} text={c} onSelect={choose} />)}
          </RadioGroup>
        </CardContent>
      </Card>
      <ActionBar>
        <Button variant="outline" onClick={() => step(-1)} disabled={i === 0}><ArrowLeft /> Back</Button>
        <span className="text-muted-foreground hidden flex-1 text-sm sm:block">{picks[i] == null ? "Pick an answer (or press A–D)" : "Press Enter to continue"}</span>
        <span className="flex-1 sm:hidden" />
        <Button onClick={() => step(1)} disabled={picks[i] == null} data-testid="next">
          {last ? <>Finish set <Check /></> : <>Next <ArrowRight /></>}
        </Button>
      </ActionBar>
    </div>
  )
}
