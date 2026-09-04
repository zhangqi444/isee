import * as React from "react"
import { ArrowRight, CalendarDays, CheckCircle2, ListChecks, PenLine, RotateCcw, Target } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { D, ORDER, SUBJ, accuracyByWeek, allWrong, currentWeek, fmtDate, nextSet, overall, recentSets, subjProgress, weekLabel } from "@/lib/content"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { upcoming } from "@/pages/calendar"
import { essayStatus } from "@/pages/essay"
import { WeekChecklistCard, weekItems } from "@/pages/checklist"
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

/** "2 subjects still have sets this week" / "Week done — next up W2 · Sep 7 – 13". */
function weekStatus(cur) {
  const left = ORDER.filter((s) => { const x = nextSet(s); return x && x.wk === cur }).length
  if (left) return `${left} subject${left === 1 ? "" : "s"} still ha${left === 1 ? "s" : "ve"} sets this week`
  const i = D.weeks.findIndex((w) => w.w === cur)
  const nx = D.weeks[i + 1]
  return nx ? `Week done — next up ${nx.w} · ${nx.label}` : "Every week of the plan is done"
}

function ScoreBadge({ pct }) {
  if (pct == null) return <Badge variant="outline">—</Badge>
  return <Badge variant={pct >= 75 ? "success" : pct >= 50 ? "warning" : "destructive"} className="tabular-nums">{pct}%</Badge>
}

export function SectionCards() {
  const o = overall()
  const misses = allWrong().length
  const cur = currentWeek()
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Sets completed</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {o.done} <span className="text-muted-foreground text-base font-normal">of {o.total}</span>
          </CardTitle>
          <CardAction><ListChecks className="text-muted-foreground size-5" /></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-2 text-sm">
          <Progress value={o.pct} className="h-1.5" />
          <div className="text-muted-foreground">{o.pct}% of the eight-week plan</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Accuracy</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{o.acc == null ? "—" : o.acc + "%"}</CardTitle>
          <CardAction><Target className="text-muted-foreground size-5" /></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">{o.right} right out of {o.answered} answered</div>
          <div className="text-muted-foreground">Across every finished set</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>To review</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{misses}</CardTitle>
          <CardAction><RotateCcw className="text-muted-foreground size-5" /></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">{misses ? "Missed questions waiting for a second try" : "Nothing waiting — finish a set to add some"}</div>
          {misses ? (
            <Button size="sm" variant="outline" onClick={() => go("/review")}>Start review <ArrowRight /></Button>
          ) : null}
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>This week</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{cur}</CardTitle>
          <CardAction><CalendarDays className="text-muted-foreground size-5" /></CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">{weekLabel(cur)}</div>
          <div className="text-muted-foreground">{(() => { const w = weekItems(cur).filter((x) => x.auto); const d = w.filter((x) => x.done).length; return `${d} of ${w.length} plan tasks done` })()}</div>
          <Button size="sm" variant="outline" onClick={() => document.querySelector("[data-testid=home-checklist]")?.scrollIntoView({ behavior: "smooth", block: "start" })}>See the list <ArrowRight /></Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export function AccuracyChart() {
  const data = accuracyByWeek()
  const any = data.some((r) => ORDER.some((s) => r[s] != null))
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

function EssayCard() {
  const done = D.weeks.filter((w) => essayStatus(w.w) === "complete").length
  const cur = currentWeek()
  const next = D.weeks.find((w) => essayStatus(w.w) !== "complete" && w.w >= cur) || D.weeks.find((w) => essayStatus(w.w) !== "complete")
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PenLine className="text-muted-foreground size-4" /> Essay</CardTitle>
        <CardDescription>One 30-minute prompt a week</CardDescription>
        <CardAction><Badge variant={done ? "success" : "outline"} className="tabular-nums">{done}/{D.weeks.length}</Badge></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Progress value={(done / D.weeks.length) * 100} className="h-1.5" />
        <div className="text-muted-foreground text-sm tabular-nums">{done} of {D.weeks.length} weeks written</div>
      </CardContent>
      <CardFooter className="gap-2">
        {next ? <Button size="sm" onClick={() => go("/essay/" + next.w)}>{essayStatus(next.w) === "in progress" ? "Continue" : "Write"} <span className="text-primary-foreground/80 font-normal">{next.w}</span></Button> : <Button size="sm" variant="secondary" disabled><CheckCircle2 /> All done</Button>}
        <Button size="sm" variant="ghost" onClick={() => go("/essay")}>All weeks</Button>
      </CardFooter>
    </Card>
  )
}

export function SubjectCards() {
  return (
    <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-5">
      {ORDER.map((s) => {
        const p = subjProgress(s)
        const nx = nextSet(s)
        return (
          <Card key={s} className="gap-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full" style={{ background: SUBJ[s].color }} />
                {SUBJ[s].name}
              </CardTitle>
              <CardDescription>{SUBJ[s].blurb}</CardDescription>
              <CardAction><ScoreBadge pct={p.acc} /></CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Progress value={p.pct} className="h-1.5" />
              <div className="text-muted-foreground text-sm tabular-nums">{p.done} of {p.total} sets done</div>
            </CardContent>
            <CardFooter className="gap-2">
              {nx ? (
                <Button size="sm" onClick={() => go(`/run/${s}/${nx.wk}/${nx.n}`)}>
                  Continue <span className="text-primary-foreground/80 font-normal">{nx.wk} · Set {nx.n + 1}</span>
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled><CheckCircle2 /> All done</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => go("/s/" + s)}>All sets</Button>
            </CardFooter>
          </Card>
        )
      })}
      <EssayCard />
    </div>
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
                <TableCell className="font-medium">{SUBJ[r.sub]?.name || r.sub}</TableCell>
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
      <SectionCards />
      <div className="grid grid-cols-1 items-start gap-4 @4xl/main:grid-cols-[3fr_2fr] md:gap-6">
        <WeekChecklistCard />
        <Breaks />
      </div>
      <SubjectCards />
      <AccuracyChart />
      <RecentSets />
    </div>
  )
}
