import * as React from "react"
import { ArrowRight, Flame, Sparkles, Trophy } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { ORDER, SUBJ } from "@/lib/content"
import { LEVELS, effortPoints, readiness, readinessHistory, skillsFor, thisWeekRange } from "@/lib/engine"
import { go } from "@/lib/router"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`
const tone = (s) => s == null ? "text-muted-foreground" : s >= 85 ? "text-success" : s >= 70 ? "text-primary" : s >= 50 ? "text-warning" : "text-destructive"

/** Ring gauge: one hue, the number in the middle. */
export function Ring({ value, size = 112, stroke = 9, color, children }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className={cn("transition-[stroke-dasharray] duration-700", color || tone(value))} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

function PartBars({ parts, compact }) {
  return (
    <ul className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2.5")} data-testid="score-parts">
      {parts.map((p) => (
        <li key={p.id} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{p.label}{!compact && <span className="text-muted-foreground text-xs font-normal"> · {p.weight}% of the score</span>}</span>
            <span className={cn("tabular-nums", p.score == null && "text-muted-foreground")}>{p.score == null ? "—" : Math.round(p.score * 100)}</span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full"><div className={cn("h-full rounded-full", p.score == null ? "bg-muted" : "bg-primary")} style={{ width: `${(p.score || 0) * 100}%` }} /></div>
          {!compact && p.note ? <span className="text-muted-foreground text-xs">{p.note}</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** Dashboard hero. */
export function ReadinessCard() {
  useStore()
  const R = readiness()
  const pts = effortPoints(thisWeekRange())
  return (
    <Card className="from-primary/5 to-card bg-gradient-to-t gap-4" data-testid="readiness">
      <CardHeader>
        <CardDescription className="flex items-center gap-2"><Trophy className="size-4" /> Readiness</CardDescription>
        <CardTitle className="text-xl">{R.label}</CardTitle>
        <CardDescription>{R.advice ? R.advice.text : "One number for how ready Sheila is, from accuracy, mocks, mastery, pacing, the review pile and consistency."}</CardDescription>
        <CardAction><Button size="sm" variant="ghost" onClick={() => go("/score")}>How it's scored <ArrowRight /></Button></CardAction>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 @2xl/main:grid-cols-[auto_1fr_1fr] @2xl/main:items-center">
        <div className="flex items-center gap-4">
          <Ring value={R.score} size={120}>
            <span className={cn("text-4xl font-semibold tabular-nums", tone(R.score))} data-testid="readiness-score">{R.score == null ? "—" : R.score}</span>
            <span className="text-muted-foreground text-[11px]">of 100</span>
          </Ring>
          <div className="flex flex-col gap-2">
            {R.streak ? (
              <div className="flex items-center gap-1.5 text-sm" data-testid="streak">
                <Flame className={cn("size-4", R.streak.current ? "text-warning" : "text-muted-foreground")} />
                <span className="font-medium tabular-nums">{R.streak.current ? `${R.streak.current}-day streak` : "No streak yet"}</span>
                {R.streak.frozen ? <span className="text-muted-foreground text-xs">({R.streak.frozen} frozen)</span> : null}
              </div>
            ) : null}
            <div className="text-muted-foreground text-xs">{R.streak && R.streak.activeToday ? "Something done today ✓" : "Nothing yet today — any set, review or word keeps the streak"}</div>
            <div className="text-muted-foreground text-xs">Best {plural(R.streak ? R.streak.best : 0, "day")} · {plural(R.streak ? R.streak.activeDays : 0, "active day")}</div>
            <div className="flex items-baseline gap-1.5 text-sm" data-testid="effort"><Sparkles className="text-primary size-3.5 self-center" /> <span className="font-medium tabular-nums">{pts} effort points</span> <span className="text-muted-foreground text-xs">this week</span></div>
          </div>
        </div>
        <PartBars parts={R.parts} compact />
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground text-xs">By subject</div>
          {ORDER.map((s) => {
            const x = R.subjects[s]
            return (
              <button key={s} type="button" className="hover:bg-accent/60 flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm" onClick={() => go("/s/" + s)}>
                <span className="inline-block size-2.5 rounded-full" style={{ background: SUBJ[s].color }} />
                <span className="w-24 shrink-0">{SUBJ[s].short}</span>
                <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"><span className="bg-primary block h-full rounded-full" style={{ width: `${x.score || 0}%` }} /></span>
                <span className={cn("w-8 text-right tabular-nums", tone(x.score))}>{x.score == null ? "—" : x.score}</span>
              </button>
            )
          })}
          {R.band.latest ? (
            <div className="text-muted-foreground mt-1 text-xs" data-testid="band">
              {R.band.lo != null ? `Estimated stanine ${R.band.lo === R.band.hi ? R.band.lo : `${R.band.lo}–${R.band.hi}`} from ${R.band.n} mocks` : `Latest mock ≈ stanine ${R.band.latest.st} — a band appears after the second mock`}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

const histConfig = { score: { label: "Readiness", color: "var(--primary)" } }

export function Score() {
  useStore()
  const R = readiness()
  const hist = readinessHistory()
  const pts = effortPoints(thisWeekRange()), total = effortPoints()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <ReadinessCard />

      <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-[3fr_2fr] md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>How the number is built</CardTitle>
            <CardDescription>Each part scores 0–100 and carries a weight. Parts with no data yet are left out and the rest are re-weighted, so the score is honest early and gets more complete as mocks and timed sets arrive.</CardDescription>
          </CardHeader>
          <CardContent><PartBars parts={R.parts} /></CardContent>
          <CardFooter className="text-muted-foreground flex-col items-start gap-1 text-xs">
            <span>Accuracy: 40% → 0, 90% → 100, recent weeks count double. Mastery: item-weighted skill levels over practiced skills. Pacing: share of timed answers inside 1.25× the real budget. Review health: nothing overdue → 100. Consistency: 8 active days in 14 → 100.</span>
            <span>Bands: 85+ Test-ready · 70+ On track · 50+ Building · below 50 Early days.</span>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Week by week</CardTitle>
            <CardDescription>Readiness as it stood at the end of each plan week.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {hist.length > 1 ? (
              <ChartContainer config={histConfig} className="aspect-auto h-[180px] w-full">
                <LineChart data={hist} margin={{ left: 0, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => p && p[0] ? `${p[0].payload.week} · ${p[0].payload.label}` : ""} />} />
                  <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="text-muted-foreground flex h-[180px] items-center justify-center text-sm">The trend line starts in Week 2.</div>
            )}
          </CardContent>
          <CardFooter className="text-muted-foreground text-xs">Effort points: {pts} this week · {total} all time. Points come from attempts, not accuracy — sets 10, mixed sets 12, mock sections 25, essays 15, precision words 2, review answers 1, tagging a miss 3.</CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
        {ORDER.map((s) => {
          const x = R.subjects[s]
          const skills = skillsFor(s).filter((k) => k.attempted)
          return (
            <Card key={s} className="gap-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><span className="inline-block size-2.5 rounded-full" style={{ background: SUBJ[s].color }} /> {SUBJ[s].name}</CardTitle>
                <CardDescription>{x.mastery.practiced ? `${x.mastery.practiced} of ${x.mastery.total} skills practiced` : "No skills practiced yet"}</CardDescription>
                <CardAction><span className={cn("text-3xl font-semibold tabular-nums", tone(x.score))}>{x.score == null ? "—" : x.score}</span></CardAction>
              </CardHeader>
              <CardContent><PartBars parts={x.parts} compact /></CardContent>
              {skills.length ? (
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead className="text-right">Right now</TableHead><TableHead className="text-right">Level</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {skills.slice(0, 6).map((k) => (
                        <TableRow key={k.sk}>
                          <TableCell className="font-medium">{k.sk}</TableCell>
                          <TableCell className="text-right tabular-nums">{k.acc == null ? "—" : Math.round(k.acc * 100) + "%"}</TableCell>
                          <TableCell className="text-right"><LevelBadge level={k.level} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              ) : null}
              <CardFooter><Button size="sm" variant="ghost" onClick={() => go("/s/" + s)}>All skills <ArrowRight /></Button></CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export function LevelBadge({ level }) {
  const i = LEVELS.indexOf(level)
  const variant = i >= 5 ? "success" : i === 4 ? "default" : i === 3 ? "secondary" : i === 2 ? "warning" : "outline"
  return <Badge variant={variant} className={cn("font-normal", i <= 1 && "text-muted-foreground")} data-level={level}>{level}</Badge>
}
