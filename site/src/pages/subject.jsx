import * as React from "react"
import { ChevronRight, Play } from "lucide-react"

import { D, SETSIZE, SUBJ, currentWeek, itemsFor, nextSet, setId, setsFor, subjProgress, weekLabel } from "@/lib/content"
import { go } from "@/lib/router"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { precisionSummary } from "@/pages/precision"
import { masteryOf, pacingFor, skillsFor } from "@/lib/engine"
import { LevelBadge } from "@/pages/score"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function ScoreBadge({ r }) {
  if (!r) return <Badge variant="outline" className="text-muted-foreground">Not started</Badge>
  const pct = r.right / r.n
  return <Badge variant={pct >= 0.75 ? "success" : pct >= 0.5 ? "warning" : "destructive"} className="tabular-nums">{r.right}/{r.n}</Badge>
}

export function WeekCard({ sub, wk, highlight }) {
  const store = useStore()
  const sets = setsFor(sub, wk)
  let done = 0
  sets.forEach((_, n) => { if (store.s.results[setId(sub, wk, n)]) done++ })
  return (
    <Card className={cn("gap-3 py-5", highlight && "border-primary/50 ring-primary/15 ring-2")}>
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2">
          {wk} <span className="text-muted-foreground font-normal">· {weekLabel(wk)}</span>
          {highlight && <Badge>This week</Badge>}
        </CardTitle>
        <CardDescription>{sub === "vr" ? "Session 1 is written; sessions 2–3 are the ISEE-style sets. " : ""}{itemsFor(sub, wk).length} questions · {sets.length} sets of about {SETSIZE}. Each set is one sitting.</CardDescription>
        <CardAction>
          <Badge variant={done === sets.length && sets.length ? "success" : done ? "warning" : "secondary"} className="tabular-nums">
            {done}/{sets.length} sets
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2">
        <ul className="flex flex-col">
          {sub === "vr" && D.precision && D.precision[wk] ? (() => {
            const ps = precisionSummary(wk)
            return (
              <li key="precision">
                <button
                  type="button"
                  onClick={() => go(`/precision/${wk}`)}
                  className="hover:bg-accent/60 focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-[3px]"
                  data-testid="precision-row"
                >
                  <span className="bg-accent text-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold">S1</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">Session 1 · Precision review</span>
                    <span className="text-muted-foreground text-xs">{ps.total} words to explain in your own words · 20–25 min{ps.submitted ? ` · submitted${ps.submittedAt ? " " + new Date(ps.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}` : ""}</span>
                  </span>
                  {ps.submitted ? <Badge variant={ps.due ? "warning" : "success"} className="tabular-nums">{ps.due ? `${ps.due} to review` : "Mastered"}</Badge> : <Badge variant="outline" className="text-muted-foreground tabular-nums">{ps.written}/{ps.total} written</Badge>}
                  <ChevronRight className="text-muted-foreground size-4" />
                </button>
              </li>
            )
          })() : null}
          {sets.map((set, n) => {
            const r = store.s.results[setId(sub, wk, n)]
            return (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => go(`/run/${sub}/${wk}/${n}`)}
                  className="hover:bg-accent/60 focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-[3px]"
                >
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">{n + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">Set {n + 1}</span>
                    <span className="text-muted-foreground text-xs">{set.length} questions{r ? ` · done${r.at ? " " + new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""} · tap to see your answers` : ""}</span>
                  </span>
                  <ScoreBadge r={r} />
                  <ChevronRight className="text-muted-foreground size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Skill levels for one subject: weakest first. Mastered needs a right answer in a later mixed set or mock. */
export function SkillsCard({ sub }) {
  const skills = skillsFor(sub)
  const practiced = skills.filter((k) => k.attempted)
  const m = masteryOf(sub), pace = pacingFor(sub)
  const [all, setAll] = React.useState(false)
  const rows = all ? skills : practiced
  return (
    <Card className="gap-3 py-5" data-testid="skills">
      <CardHeader className="px-5">
        <CardTitle>Skills</CardTitle>
        <CardDescription>
          {practiced.length ? `${m.mastered} mastered · ${m.proficient} proficient · ${practiced.length} of ${skills.length} practiced` : `${skills.length} skills in this subject — levels appear after the first set`}
          {pace.n >= 8 ? ` · median ${Math.round(pace.median)} s a question against a ${pace.budget} s budget` : ""}
        </CardDescription>
        <CardAction><Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>{all ? "Practiced only" : "All skills"}</Button></CardAction>
      </CardHeader>
      {rows.length ? (
        <CardContent className="px-5">
          <Table>
            <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead className="hidden @md/main:table-cell">Weeks</TableHead><TableHead className="text-right">Right now</TableHead><TableHead className="text-right">Level</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((k) => (
                <TableRow key={k.sk}>
                  <TableCell className="font-medium">{k.sk}{k.overdue ? <span className="text-warning ml-2 text-xs">{k.overdue} due</span> : null}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs @md/main:table-cell">{k.weeks.join(" ")}</TableCell>
                  <TableCell className="text-right tabular-nums">{k.acc == null ? "—" : `${Math.round(k.acc * 100)}% · ${k.attempted}/${k.total}`}</TableCell>
                  <TableCell className="text-right"><LevelBadge level={k.level} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      ) : null}
    </Card>
  )
}

export function Subject({ sub, wk }) {
  useStore()
  const p = subjProgress(sub)
  const nx = nextSet(sub)
  const cur = currentWeek()
  const weeks = wk ? D.weeks.filter((w) => w.w === wk) : D.weeks
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">{SUBJ[sub].name}</CardTitle>
          <CardDescription>{SUBJ[sub].blurb}</CardDescription>
          <CardAction>
            {nx ? (
              <Button onClick={() => go(`/run/${sub}/${nx.wk}/${nx.n}`)}><Play /> Continue</Button>
            ) : (
              <Badge variant="success">All sets done</Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Progress value={p.pct} className="h-1.5" />
          <div className="text-muted-foreground flex flex-wrap gap-x-4 text-sm tabular-nums">
            <span>{p.done} of {p.total} sets done</span>
            {p.acc != null && <span>{p.acc}% accuracy</span>}
          </div>
        </CardContent>
      </Card>
      {!wk && <SkillsCard sub={sub} />}
      {weeks.map((w) => (
        <WeekCard key={w.w} sub={sub} wk={w.w} highlight={w.w === cur} />
      ))}
    </div>
  )
}
