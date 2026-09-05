import * as React from "react"
import {
  Award, BookA, Brain, CalendarCheck, CalendarDays, Check, Crosshair, Crown, Feather, Flame,
  Footprints, Gauge, Gift, ListChecks, Lock, Medal, PenLine, Plus, RotateCcw, Search, Shuffle,
  Sparkles, Star, Target, Timer, Trash2, Trophy,
} from "lucide-react"

import { fmtDate } from "@/lib/content"
import { effortPoints, thisWeekRange } from "@/lib/engine"
import {
  BADGES, BADGE_GROUPS, LEVELS, SUGGESTED, addReward, badgeCounts, badgeState, cancelClaim,
  claimReward, claims, markGiven, nextBadge, recentBadges, removeReward, shelf, syncBadges,
  updateReward, wallet,
} from "@/lib/rewards"
import { go } from "@/lib/router"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Ring } from "@/pages/score"

const ICONS = {
  Award, BookA, Brain, CalendarCheck, CalendarDays, Crosshair, Crown, Feather, Flame, Footprints,
  Gauge, ListChecks, Library: BookA, Medal, PenLine, RotateCcw, Search, Shuffle, Sparkles, Star, Target, Timer, Trophy,
}
export function BadgeIcon({ name, className }) { const I = ICONS[name] || Award; return <I className={className} /> }

/** Keep pinned badges up to date whenever a page that shows them is open. */
export function useBadgeSync() {
  const store = useStore()
  React.useEffect(() => { syncBadges() }, [store.snapshot()])
}

function Medallion({ b, size = 56 }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        b.done ? "border-primary/40 bg-primary/10 text-primary" : "border-dashed border-muted-foreground/25 bg-muted/40 text-muted-foreground/50"
      )}
      style={{ width: size, height: size }}
    >
      {b.done ? <BadgeIcon name={b.icon} className="size-6" /> : <Lock className="size-4" />}
    </div>
  )
}

function BadgeCard({ b }) {
  return (
    <li className={cn("flex items-start gap-3 rounded-lg border p-3", b.done ? "bg-card" : "bg-muted/20")} data-testid="badge" data-done={b.done ? "1" : "0"} data-id={b.id}>
      <Medallion b={b} size={48} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("text-sm font-medium", !b.done && "text-muted-foreground")}>{b.name}</span>
          {b.done ? <span className="text-muted-foreground shrink-0 text-xs">{b.at ? fmtDate(b.at) : "earned"}</span> : <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{Math.min(b.have, b.need)}/{b.need}</span>}
        </div>
        <span className="text-muted-foreground text-xs">{b.desc}</span>
        {!b.done ? <Progress value={b.pct} className="mt-0.5 h-1" /> : null}
      </div>
    </li>
  )
}

/** Compact dashboard card: level, balance, what is close, what was just earned. */
export function RewardsCard() {
  useBadgeSync()
  const w = wallet()
  const counts = badgeCounts()
  const recent = recentBadges(7).slice(0, 4)
  const next = nextBadge()
  const pending = claims().filter((c) => c.status === "claimed")
  return (
    <Card className="gap-4" data-testid="rewards-card">
      <CardHeader>
        <CardDescription className="flex items-center gap-2"><Trophy className="size-4" /> Rewards</CardDescription>
        <CardTitle className="font-serif text-xl">Level {w.level.n} · {w.level.title}</CardTitle>
        <CardDescription className="tabular-nums">{counts.earned} of {counts.total} badges · {w.balance} points to spend</CardDescription>
        <CardAction><Button size="sm" variant="ghost" onClick={() => go("/rewards")}>Open <Gift /></Button></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Progress value={w.level.pct} className="h-1.5" />
          <span className="text-muted-foreground text-xs tabular-nums">{w.level.next ? `${w.level.next.at - w.lifetime} points to Level ${w.level.next.n} · ${w.level.next.title}` : "Top level reached"}</span>
        </div>
        {recent.length ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Just earned</span>
            <div className="flex flex-wrap gap-2">
              {recent.map((b) => (
                <Tooltip key={b.id}>
                  <TooltipTrigger asChild><span><Medallion b={b} size={40} /></span></TooltipTrigger>
                  <TooltipContent>{b.name} — {b.desc}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        ) : null}
        {next ? (
          <div className="flex flex-col gap-1" data-testid="next-badge">
            <span className="text-muted-foreground text-xs">Closest badge</span>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{next.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{Math.min(next.have, next.need)}/{next.need} {next.unit}</span>
            </div>
            <Progress value={next.pct} className="h-1" />
            <span className="text-muted-foreground text-xs">{next.desc}</span>
          </div>
        ) : null}
        {pending.length ? <div className="text-warning text-xs" data-testid="pending-claims">{pending.length} reward{pending.length === 1 ? "" : "s"} claimed, waiting to be handed over</div> : null}
      </CardContent>
    </Card>
  )
}

function Shelf() {
  const w = wallet()
  const list = shelf()
  const cs = claims()
  const [name, setName] = React.useState("")
  const [cost, setCost] = React.useState(200)
  function add() { const t = name.trim(); if (!t) return; addReward(t, cost); setName(""); setCost(200) }
  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3 py-5">
        <CardHeader className="px-5">
          <CardTitle>Reward shelf</CardTitle>
          <CardDescription>Points are earned for doing the work, not for being right — so a hard set pays the same as an easy one. Qi sets what they buy; Sheila claims one when she has enough.</CardDescription>
          <CardAction><Badge variant={w.balance ? "success" : "outline"} className="tabular-nums" data-testid="balance">{w.balance} to spend</Badge></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-5">
          {list.length ? (
            <ul className="divide-y rounded-md border">
              {list.map((r) => {
                const affordable = w.balance >= r.cost
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="reward-item">
                    <Gift className={cn("size-4 shrink-0", affordable ? "text-primary" : "text-muted-foreground")} />
                    <span className="min-w-0 flex-1 text-sm font-medium">{r.name}</span>
                    <Input
                      type="number" min="10" step="10" value={r.cost} aria-label={`Cost of ${r.name}`}
                      onChange={(e) => updateReward(r.id, { cost: Math.max(10, +e.target.value || 10) })}
                      className="h-8 w-24 tabular-nums"
                    />
                    <Button size="sm" disabled={!affordable} onClick={() => claimReward(r)} data-testid={`claim-${r.id}`}>{affordable ? "Claim" : `${r.cost - w.balance} short`}</Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => removeReward(r.id)}><Trash2 /></Button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Nothing on the shelf yet — add one below, or start from a suggestion.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add() }} placeholder="Add a reward Sheila can work toward" className="h-9 min-w-48 flex-1" data-testid="reward-add" />
            <Input type="number" min="10" step="10" value={cost} onChange={(e) => setCost(+e.target.value || 0)} aria-label="Cost in points" className="h-9 w-24 tabular-nums" />
            <Button variant="outline" onClick={add}><Plus /> Add</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.filter((s) => !list.some((r) => r.name === s.name)).map((s) => (
              <Button key={s.name} size="sm" variant="outline" className="h-7 text-xs font-normal" onClick={() => addReward(s.name, s.cost)}>
                <Plus /> {s.name} · {s.cost}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {cs.length ? (
        <Card className="gap-3 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Claimed</CardTitle>
            <CardDescription>Points come off when a reward is claimed. Cancelling puts them straight back.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ul className="divide-y rounded-md border">
              {cs.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5" data-testid="claim-row" data-status={c.status}>
                  {c.status === "given" ? <Check className="text-success size-4 shrink-0" /> : <Gift className="text-warning size-4 shrink-0" />}
                  <span className="min-w-0 flex-1 text-sm font-medium">{c.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">{c.cost} pts · {fmtDate(c.at)}</span>
                  {c.status === "given" ? (
                    <Badge variant="success">Given</Badge>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => markGiven(c.id)} data-testid="mark-given">Mark as given</Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelClaim(c.id)}>Cancel</Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export function Rewards() {
  useBadgeSync()
  const w = wallet()
  const all = badgeState()
  const counts = badgeCounts()
  const week = effortPoints(thisWeekRange())
  const [showLocked, setLocked] = React.useState(true)
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><Trophy className="size-4" /> Rewards</CardDescription>
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight">Level {w.level.n} · {w.level.title}</CardTitle>
          <CardDescription>Points are for showing up and doing the work — every set, review, word, essay and mock pays, whatever the score. Badges are earned once and kept for good.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <Ring value={w.level.pct} size={112} color="text-primary">
            <span className="font-serif text-3xl font-semibold tabular-nums" data-testid="level">{w.level.n}</span>
            <span className="text-muted-foreground text-[11px]">level</span>
          </Ring>
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span className="font-serif text-2xl font-semibold tabular-nums">{w.lifetime}</span> <span className="text-muted-foreground">points earned</span></span>
              <span><span className="font-serif text-2xl font-semibold tabular-nums" data-testid="wallet-balance">{w.balance}</span> <span className="text-muted-foreground">to spend</span></span>
              <span><span className="font-serif text-2xl font-semibold tabular-nums">{counts.earned}</span> <span className="text-muted-foreground">of {counts.total} badges</span></span>
            </div>
            <Progress value={w.level.pct} className="h-1.5" />
            <span className="text-muted-foreground text-xs tabular-nums">
              {w.level.next ? `${w.level.next.at - w.lifetime} points to Level ${w.level.next.n} · ${w.level.next.title}` : "Top level reached"} · {week} earned this week{w.spent ? ` · ${w.spent} spent so far` : ""}
            </span>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <Badge key={l.n} variant={w.level.n >= l.n ? "secondary" : "outline"} className={cn("font-normal", w.level.n < l.n && "text-muted-foreground/70")}>
              {l.n}. {l.title}<span className="tabular-nums opacity-60"> · {l.at}</span>
            </Badge>
          ))}
        </CardFooter>
      </Card>

      <Shelf />

      <Card className="gap-3 py-5">
        <CardHeader className="px-5">
          <CardTitle>Badges</CardTitle>
          <CardDescription>{counts.earned} earned · {counts.total - counts.earned} to go. Once earned, a badge stays earned.</CardDescription>
          <CardAction><Button size="sm" variant="ghost" onClick={() => setLocked((v) => !v)}>{showLocked ? "Earned only" : "Show all"}</Button></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 px-5">
          {BADGE_GROUPS.map((g) => {
            const mine = all.filter((b) => b.group === g && (showLocked || b.done))
            if (!mine.length) return null
            const done = all.filter((b) => b.group === g && b.done).length
            return (
              <div key={g} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-base font-semibold">{g}</h3>
                  <span className="text-muted-foreground text-xs tabular-nums">{done}/{all.filter((b) => b.group === g).length}</span>
                </div>
                <ul className="grid grid-cols-1 gap-2 @2xl/main:grid-cols-2">
                  {mine.sort((a, b) => (b.done - a.done) || a.need - b.need).map((b) => <BadgeCard key={b.id} b={b} />)}
                </ul>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
