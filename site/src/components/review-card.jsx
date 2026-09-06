import * as React from "react"
import { CheckCircle2, MessageSquareText, Sparkles } from "lucide-react"

import { D, fmtDate } from "@/lib/content"
import { isSeen, markSeen } from "@/lib/reviews"
import { ts } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/** One review of one essay, written to her. `changedAt` is when the essay last
 *  changed, so a review of an older draft says so instead of looking wrong. */
export function ReviewCard({ r, changedAt }) {
  // "New" stays for this visit; the dot elsewhere goes as soon as she has opened it.
  const [fresh] = React.useState(() => !isSeen(r.id))
  React.useEffect(() => { markSeen(r.id) }, [r.id])
  const dims = (D.essay && D.essay.rubric && D.essay.rubric.dimensions) || []
  const stale = r.draftAt && changedAt && ts(changedAt) > ts(r.draftAt) + 60000
  return (
    <Card className="border-primary/30 gap-4" data-testid="essay-review" data-id={r.id}>
      <CardHeader>
        <CardDescription className="flex items-center gap-2"><MessageSquareText className="size-4" /> Review · {r.reviewer} · {fmtDate(r.at)}</CardDescription>
        <CardTitle className="text-lg">What a reader noticed</CardTitle>
        {r.source ? <CardDescription>Read from {r.source}{r.words ? ` · ${r.words} words` : ""}</CardDescription> : r.words ? <CardDescription>{r.words} words</CardDescription> : null}
        {fresh ? <CardAction><Badge>New</Badge></CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed">{r.summary}</p>
        {r.strengths.length ? (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">What worked</div>
            <ul className="flex flex-col gap-1.5">
              {r.strengths.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm leading-relaxed"><CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" /> <span>{s}</span></li>)}
            </ul>
          </div>
        ) : null}
        {r.suggestions.length ? (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Try this</div>
            <ol className="flex flex-col gap-1.5">
              {r.suggestions.map((s, i) => <li key={i} className="flex items-start gap-2 text-sm leading-relaxed"><span className="bg-muted text-muted-foreground mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">{i + 1}</span> <span>{s}</span></li>)}
            </ol>
          </div>
        ) : null}
        {r.next ? <div className="bg-accent text-accent-foreground flex items-start gap-2 rounded-md px-3 py-2 text-sm"><Sparkles className="mt-0.5 size-4 shrink-0" /> <span><span className="font-medium">For next week:</span> {r.next}</span></div> : null}
        {r.rubric ? (
          <div className="flex flex-wrap gap-1.5" data-testid="review-rubric">
            {dims.filter((d) => r.rubric[d.name]).map((d) => {
              const n = r.rubric[d.name]
              return <Badge key={d.name} variant={n >= 3 ? "success" : "secondary"} className="tabular-nums" title={d.levels[n - 1]}>{d.name} · {n} <span className="font-normal opacity-80">{d.levels[n - 1]}</span></Badge>
            })}
          </div>
        ) : null}
        {stale ? <p className="text-muted-foreground text-xs">This review is of the draft from {fmtDate(r.draftAt)}; the work here has changed since.</p> : null}
      </CardContent>
    </Card>
  )
}
