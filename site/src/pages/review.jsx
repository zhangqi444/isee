import * as React from "react"
import { CalendarClock, Play, ShieldCheck, Sparkles } from "lucide-react"

import { ORDER, SUBJ, fmtDate } from "@/lib/content"
import { CAUSES, INTERVALS, causeBreakdown, missProfile, reviewQueue, skillOf } from "@/lib/engine"
import { go } from "@/lib/router"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

/** Small horizontal breakdown of misses by cause. */
export function CauseBar({ profile, className }) {
  const total = CAUSES.reduce((n, c) => n + (profile[c.id] || 0), 0) + (profile.untagged || 0)
  if (!total) return null
  const tone = { know: "bg-chart-1", misread: "bg-chart-2", careless: "bg-chart-3", rushed: "bg-chart-4", untagged: "bg-muted-foreground/30" }
  return (
    <div className={className} data-testid="cause-bar">
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {[...CAUSES.map((c) => c.id), "untagged"].map((k) => profile[k] ? <span key={k} className={tone[k]} style={{ width: `${(profile[k] / total) * 100}%` }} /> : null)}
      </div>
      <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {CAUSES.map((c) => profile[c.id] ? <span key={c.id}><span className={`mr-1 inline-block size-2 rounded-full align-middle ${tone[c.id]}`} />{c.label} · {profile[c.id]}</span> : null)}
        {profile.untagged ? <span><span className={`mr-1 inline-block size-2 rounded-full align-middle ${tone.untagged}`} />untagged · {profile.untagged}</span> : null}
      </div>
    </div>
  )
}

export function Review() {
  useStore()
  const q = reviewQueue()
  const anyPile = q.due.length + q.scheduled.length + q.checkin.length
  const profile = missProfile()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          A missed question comes back after {INTERVALS[0]} day, then {INTERVALS[1]} days, then a week. Get it right on two spaced days and it leaves the pile — with one check-in three weeks later to make sure it stuck. Words rated shaky in the precision review are in here too.
        </p>
      </div>

      {profile.total ? (
        <Card className="gap-3 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Why misses happen</CardTitle>
            <CardDescription>{profile.total} questions missed so far{profile.untagged ? ` · ${profile.untagged} still untagged` : ""}{profile.sure ? ` · ${profile.sure} felt sure at the time` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="px-5"><CauseBar profile={profile} /></CardContent>
        </Card>
      ) : null}

      {!anyPile ? (
        <Card className="items-center py-12 text-center" data-testid="review-empty">
          <CardHeader className="items-center">
            <Sparkles className="text-primary mb-2 size-8" />
            <CardTitle>Nothing waiting</CardTitle>
            <CardDescription>Finish a set and anything you miss collects here on a schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => go("/")}>Back to dashboard</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
          {ORDER.map((s) => {
            const due = q.due.filter((x) => x.sub === s), sched = q.scheduled.filter((x) => x.sub === s), chk = q.checkin.filter((x) => x.sub === s)
            if (!due.length && !sched.length && !chk.length) return null
            const skills = {}
            due.forEach((x) => { const sk = x.src === "word" ? "Precision words" : skillOf(s, x.it); if (sk) skills[sk] = (skills[sk] || 0) + 1 })
            const top = Object.entries(skills).sort((a, b) => b[1] - a[1]).slice(0, 3)
            const next = sched[0]
            return (
              <Card key={s} className="gap-4" data-testid={`review-${s}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full" style={{ background: SUBJ[s].color }} />
                    {SUBJ[s].name}
                  </CardTitle>
                  <CardDescription>
                    {due.length ? `${due.length} due now` : "Nothing due today"}
                    {sched.length ? ` · ${sched.length} scheduled${next ? `, next ${fmtDate(next.rec.due)}` : ""}` : ""}
                    {chk.length ? ` · ${chk.length} check-in${chk.length === 1 ? "" : "s"}` : ""}
                  </CardDescription>
                  <CardAction>{due.length ? <Badge variant="warning" className="tabular-nums" data-testid={`due-${s}`}>{due.length}</Badge> : <Badge variant="outline" className="text-muted-foreground"><CalendarClock /> {sched.length}</Badge>}</CardAction>
                </CardHeader>
                {top.length ? (
                  <CardContent className="flex flex-wrap gap-1.5">
                    {top.map(([sk, n]) => <Badge key={sk} variant="outline" className="font-normal">{sk} · {n}</Badge>)}
                  </CardContent>
                ) : null}
                {due.length ? <CardContent><CauseBar profile={causeBreakdown(due)} /></CardContent> : null}
                <CardFooter className="flex-wrap gap-2">
                  {due.length ? <Button size="sm" onClick={() => go("/review/" + s)} data-testid={`start-review-${s}`}><Play /> Review {due.length} due</Button> : null}
                  {sched.length ? <Button size="sm" variant={due.length ? "ghost" : "outline"} onClick={() => go(`/review/${s}/all`)}>Everything · {due.length + sched.length}</Button> : null}
                  {chk.length ? <Button size="sm" variant="outline" onClick={() => go(`/review/${s}/checkin`)}><ShieldCheck /> Check-in · {chk.length}</Button> : null}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
