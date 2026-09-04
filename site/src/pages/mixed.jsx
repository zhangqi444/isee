import * as React from "react"
import { Play, Shuffle } from "lucide-react"

import { ORDER, SUBJ, fmtDate } from "@/lib/content"
import { buildMixedSet, dayKey, mixedResults } from "@/lib/engine"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Runner } from "@/pages/runner"

export function mixedThisWeek(range) {
  return mixedResults().some((r) => { const k = dayKey(r.at); return k >= range[0] && k <= range[1] })
}

export function Mixed() {
  useStore()
  const rows = mixedResults()
  const preview = React.useMemo(() => buildMixedSet(12), [rows.length])
  const counts = {}
  for (const q of preview) { const s = q.id.split("-")[0].toLowerCase(); counts[s] = (counts[s] || 0) + 1 }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><Shuffle className="size-4" /> Mixed practice</CardDescription>
          <CardTitle className="font-serif text-2xl font-semibold tracking-tight">Twelve questions, all four subjects, shuffled</CardTitle>
          <CardDescription>The real test never tells you which skill a question is testing. A mixed set pulls from the weeks already reached — skills sitting at Proficient (a right answer here is what promotes them to Mastered) and weak ones first. One a week from Week 2.</CardDescription>
          <CardAction>
            <Button onClick={() => go("/mixed/run")} disabled={preview.length < 4} data-testid="mixed-start"><Play /> Start a mixed set</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {ORDER.map((s) => <Badge key={s} variant="outline" className="font-normal"><span className="mr-1 inline-block size-2 rounded-full" style={{ background: SUBJ[s].color }} />{SUBJ[s].short} · {counts[s] || 0}</Badge>)}
          {preview.length < 12 ? <span className="text-muted-foreground text-xs">Only {preview.length} questions are eligible today — more open up as weeks are finished.</span> : null}
        </CardContent>
      </Card>

      {rows.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Mixed sets so far</CardTitle>
            <CardDescription>Most recent first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead className="text-right">Score</TableHead>{ORDER.map((s) => <TableHead key={s} className="hidden text-right @md/main:table-cell">{SUBJ[s].short}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.at)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.right}/{r.n}</TableCell>
                    {ORDER.map((s) => <TableCell key={s} className="text-muted-foreground hidden text-right tabular-nums @md/main:table-cell">{r.bySub && r.bySub[s] ? `${r.bySub[s].right}/${r.bySub[s].n}` : "—"}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export function MixedRun() {
  const items = React.useMemo(() => buildMixedSet(12), [])
  if (items.length < 4) return <Mixed />
  const key = "mx:" + new Date().toISOString().slice(0, 16)
  return (
    <Runner
      key={key}
      items={items}
      custom
      ctx="mixed"
      title="Mixed set · all subjects"
      exitPath="/mixed"
      exitLabel="Back to mixed practice"
      onFinish={(sum) => Store.setSlice("mixed", key, () => ({ ...sum }))}
    />
  )
}
