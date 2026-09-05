import * as React from "react"
import { ArrowRight, BookMarked, CheckCircle2, Flame, ListChecks, PenLine, Play, RotateCcw, Shuffle, Sparkles } from "lucide-react"
import { effortPoints, streakInfo, thisWeekRange } from "@/lib/engine"
import { currentBook, readToday } from "@/lib/books"
import { ReadinessCard } from "@/pages/score"
import { RewardsCard } from "@/pages/rewards"
import { ReadingCard } from "@/pages/books"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { D, ORDER, SUBJ, accuracyByWeek, currentWeek, fmtDate, nextSet, overall, recentSets, subjProgress, weekLabel } from "@/lib/content"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { upcoming } from "@/pages/calendar"
import { essayStatus } from "@/pages/essay"
import { WeekChecklistCard, nextUp, weekLeft } from "@/pages/checklist"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const chartConfig = {
  vr: { label: "Verbal", color: "var(--chart-1)" },
  qr: { label: "Quantitative", color: "var(--chart-2)" },
  ma: { label: "Math", color: "var(--chart-3)" },
  rc: { label: "Reading", color: "var(--chart-4)" },
}

function ScoreBadge({ pct }) {
  if (pct == null) return <Badge variant="outline">—</Badge>
  return <Badge variant={pct >= 75 ? "success" : pct >= 50 ? "warning" : "destructive"} className="tabular-nums">{pct}%</Badge>
}

/** What to do now. The dashboard's only job at the top of the page. */
export function TodayCard() {
  useStore()
  const o = overall()
  const cur = currentWeek()
  const st = streakInfo()
  const pts = effortPoints(thisWeekRange())
  const book = currentBook()

  const next = nextUp()
  const week = weekLeft(cur)

  // everything the week still expects, straight from the checklist so the two agree
  const jobs = week.items.filter((x) => x.path).slice(0, 5).map((x) => ({
    id: x.id, icon: x.id.startsWith("review") ? RotateCcw : x.id.startsWith("essay") ? PenLine : x.id.startsWith("mixed") ? Shuffle : ListChecks,
    label: `${x.tag} · ${x.short || x.label}`, sub: x.sub || "", path: x.path,
  }))
  if (book && !readToday()) jobs.push({ id: "read", icon: BookMarked, label: `Reading · ${book.title}`, sub: "reading days count too", path: "/books" })

  const rest = jobs.filter((j) => !next || j.path !== next.path)

  return (
    <Card className="from-primary/5 to-card bg-gradient-to-t gap-4" data-testid="today">
      <CardHeader>
        <CardDescription className="flex items-center gap-2"><Play className="size-4" /> Today</CardDescription>
        <CardTitle className="text-xl">{next ? next.label : "Everything in the plan is done"}</CardTitle>
        <CardDescription>
          {cur} · {weekLabel(cur)} · {week.left ? `${week.left} of ${week.total} left this week` : "this week is clear"}
          {next && next.note ? ` · ${next.note}` : ""}
        </CardDescription>
        <CardAction>
          {next ? <Button onClick={() => go(next.path)} data-testid="continue"><Play /> Continue</Button> : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Progress value={o.pct} className="h-1.5" />
        <div className="text-muted-foreground text-xs tabular-nums">{o.done} of {o.total} sets done · {o.pct}% of the plan</div>
        {rest.length ? (
          <ul className="divide-y rounded-md border" data-testid="today-jobs">
            {rest.map((j) => (
              <li key={j.id} className="flex items-center gap-3 px-3 py-2">
                <j.icon className="text-muted-foreground size-4 shrink-0" />
                <button type="button" className="min-w-0 flex-1 text-left text-sm font-medium hover:underline" onClick={() => go(j.path)}>{j.label}</button>
                <span className="text-muted-foreground hidden shrink-0 text-xs @md/main:block">{j.sub}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-success flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium"><CheckCircle2 className="size-4" /> Nothing hanging over today — anything now is ahead of the plan.</div>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5"><Flame className={cn("size-3.5", st.current ? "text-warning" : "")} />{st.current ? `${st.current}-day streak` : "No streak yet"}{st.activeToday ? " · something done today" : ""}</span>
        <span className="flex items-center gap-1.5"><Sparkles className="text-primary size-3.5" />{pts} effort points this week</span>
        <span>{o.acc == null ? "No accuracy yet" : `${o.acc}% correct across every finished set`}</span>
      </CardFooter>
    </Card>
  )
}

export function AccuracyChart() {
  const data = accuracyByWeek()
  const weeksWithData = data.filter((r) => ORDER.some((s) => r[s] != null)).length
  const any = weeksWithData > 0
  // one lonely bar in eight empty slots says nothing; the table below says it better
  if (weeksWithData < 2) return null
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Accuracy by week</CardTitle>
        <CardDescription>Percent correct on finished sets, per subject</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {any ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
            <BarChart data={data} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => v + "%"} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(_, p) => p && p[0] ? `${p[0].payload.week} · ${p[0].payload.label}` : ""} formatter={(v, n) => [`${v}%`, chartConfig[n]?.label || n]} />} />
              <ChartLegend content={<ChartLegendContent />} itemSorter={(item) => ORDER.indexOf(item.dataKey)} />
              {ORDER.map((s) => (
                <Bar key={s} dataKey={s} fill={`var(--color-${s})`} radius={4} maxBarSize={22} />
              ))}
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">Finish a set and the chart fills in.</div>
        )}
      </CardContent>
    </Card>
  )
}

/** One row per subject: where she is, how she is doing, and the way in. */
export function SubjectCards() {
  useStore()
  const cur = currentWeek()
  const essayDone = D.weeks.filter((w) => essayStatus(w.w) === "complete").length
  const nextEssay = D.weeks.find((w) => essayStatus(w.w) !== "complete" && w.w >= cur) || D.weeks.find((w) => essayStatus(w.w) !== "complete")
  return (
    <Card className="gap-2 py-4" data-testid="subjects">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Subjects</CardTitle>
        <CardDescription>Sets done, and how accurate she has been on them.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y">
          {ORDER.map((s) => {
            const p = subjProgress(s)
            const nx = nextSet(s)
            return (
              <li key={s} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5" data-testid="subject-row">
                <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: SUBJ[s].color }} />
                <button type="button" className="w-full text-left text-sm font-medium hover:underline @md/main:w-44 @md/main:shrink-0" onClick={() => go("/s/" + s)}>{SUBJ[s].name}</button>
                <span className="flex w-full items-center gap-3 @md/main:w-auto @md/main:min-w-32 @md/main:flex-1">
                  <Progress value={p.pct} className="h-1.5 flex-1" />
                  <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">{p.done} of {p.total} sets</span>
                </span>
                <ScoreBadge pct={p.acc} />
                {nx ? (
                  <Button size="sm" variant="outline" onClick={() => go(`/run/${s}/${nx.wk}/${nx.n}`)}>{nx.wk} · Set {nx.n + 1}</Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled><CheckCircle2 /> Done</Button>
                )}
              </li>
            )
          })}
          <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5" data-testid="subject-row">
            <PenLine className="text-muted-foreground size-3.5 shrink-0" />
            <button type="button" className="w-full text-left text-sm font-medium hover:underline @md/main:w-44 @md/main:shrink-0" onClick={() => go("/essay")}>Essay</button>
            <span className="flex w-full items-center gap-3 @md/main:w-auto @md/main:min-w-32 @md/main:flex-1">
              <Progress value={(essayDone / D.weeks.length) * 100} className="h-1.5 flex-1" />
              <span className="text-muted-foreground w-24 shrink-0 text-xs tabular-nums">{essayDone} of {D.weeks.length} weeks</span>
            </span>
            <Badge variant="outline" className="text-muted-foreground">30 min</Badge>
            {nextEssay ? <Button size="sm" variant="outline" onClick={() => go("/essay/" + nextEssay.w)}>Write {nextEssay.w}</Button> : <Button size="sm" variant="ghost" disabled><CheckCircle2 /> Done</Button>}
          </li>
        </ul>
      </CardContent>
    </Card>
  )
}

export function RecentSets() {
  const rows = recentSets(8)
  if (!rows.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent sets</CardTitle>
        <CardDescription>Most recent first. Week-1 rows came over from the Google Sheets.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Week</TableHead>
              <TableHead>Set</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="hidden text-right @md/main:table-cell">Missed</TableHead>
              <TableHead className="hidden text-right @sm/main:table-cell">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => go(`/s/${r.sub}/${r.wk}`)}>
                <TableCell className="font-medium">{SUBJ[r.sub]?.short || r.sub}</TableCell>
                <TableCell>{r.wk}</TableCell>
                <TableCell>Set {r.set + 1}</TableCell>
                <TableCell className="text-right tabular-nums">{r.right}/{r.n}</TableCell>
                <TableCell className="hidden text-right tabular-nums @md/main:table-cell">{(r.wrong || []).length}</TableCell>
                <TableCell className="text-muted-foreground hidden text-right @sm/main:table-cell">{fmtDate(r.at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function Breaks() {
  const ev = upcoming(5)
  const test = Store.s.testDate
  const days = test ? Math.round((new Date(test + "T00:00:00") - new Date(new Date().toISOString().slice(0, 10) + "T00:00:00")) / 86400000) : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coming up</CardTitle>
        <CardDescription>{test ? `${days} days until Sheila's ISEE.` : "Mocks, ISEE windows and deadlines. Set her real test date on the calendar for a countdown."}</CardDescription>
        <CardAction><Button size="sm" variant="ghost" onClick={() => go("/calendar")}>Calendar <ArrowRight /></Button></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {ev.map((e) => (
          <div key={e.id} className="flex items-start gap-3 py-2 text-sm first:pt-0 last:pb-0">
            <span className="text-muted-foreground w-14 shrink-0 text-xs tabular-nums">{new Date(e.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            {e.path ? <button type="button" className="text-left font-medium hover:underline" onClick={() => go(e.path)}>{e.title}</button> : <span className="font-medium">{e.title}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function Home() {
  useStore()
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid grid-cols-1 gap-4 @4xl/main:grid-cols-[3fr_2fr] md:gap-6">
        <TodayCard />
        <ReadinessCard />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 @4xl/main:grid-cols-[3fr_2fr] md:gap-6">
        <WeekChecklistCard />
        <div className="flex flex-col gap-4 md:gap-6">
          <RewardsCard />
          <ReadingCard />
          <Breaks />
        </div>
      </div>
      <SubjectCards />
      <AccuracyChart />
      <RecentSets />
    </div>
  )
}
