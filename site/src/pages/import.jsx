import * as React from "react"
import { ChevronRight, Inbox, MessageSquareText } from "lucide-react"

import { fmtDate } from "@/lib/content"
import { addReviews, parseImport, reviewPath, reviewTargetLabel } from "@/lib/reviews"
import { go } from "@/lib/router"
import { DRIVE_ENABLED, useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

/** #/import/<payload> — a review link made outside the app (docs/review.md).
 *  With no payload it is a paste box, for a phone that cannot open the long link. */
export function Import({ payload }) {
  const store = useStore()
  const [text, setText] = React.useState("")
  const [err, setErr] = React.useState(null)
  const [added, setAdded] = React.useState(null)
  const fromLink = React.useMemo(() => {
    if (!payload) return null
    try { return { map: parseImport(payload) } } catch (e) { return { err: e.message } }
  }, [payload])

  function add(map) {
    const list = Object.values(map)
    addReviews(map)
    setAdded(list)
    if (list.length === 1) go(reviewPath(list[0]))
  }
  function addPasted() {
    try { add(parseImport(text)) } catch (e) { setErr(e.message) }
  }
  const preview = fromLink && fromLink.map ? Object.values(fromLink.map) : []

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-3">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><Inbox className="size-4" /> Add a review</CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-tight">A review of one of Sheila's essays</CardTitle>
          <CardDescription>It is kept with her progress{DRIVE_ENABLED && store.s.driveGranted ? " and mirrored to Google Drive" : ""}, and shows on the essay it is about.</CardDescription>
        </CardHeader>
      </Card>

      {added ? (
        <Card className="gap-3">
          <CardHeader><CardTitle>Added</CardTitle><CardDescription>{added.length === 1 ? "Opening the essay it belongs to." : `${added.length} reviews added.`}</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {added.map((r) => <Button key={r.id} variant="outline" size="sm" onClick={() => go(reviewPath(r))}>{reviewTargetLabel(r)} <ChevronRight /></Button>)}
          </CardContent>
        </Card>
      ) : preview.length ? (
        <Card className="gap-4" data-testid="import-preview">
          <CardHeader>
            <CardTitle>{preview.length === 1 ? "One review" : `${preview.length} reviews`} in this link</CardTitle>
            <CardDescription>Check it is the right essay, then add it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="divide-y rounded-md border">
              {preview.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><MessageSquareText className="text-muted-foreground size-4" /> <span className="font-medium">{reviewTargetLabel(r)}</span> <span className="text-muted-foreground">· {r.reviewer} · {fmtDate(r.at)}</span></div>
                  <p className="text-muted-foreground line-clamp-2 text-sm">{r.summary}</p>
                </li>
              ))}
            </ul>
            <div><Button onClick={() => add(fromLink.map)} data-testid="import-add"><Inbox /> Add to Sheila's progress</Button></div>
          </CardContent>
        </Card>
      ) : null}

      {!added ? (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>{preview.length ? "Or paste one" : "Paste the review"}</CardTitle>
            <CardDescription>{fromLink && fromLink.err ? <span className="text-destructive">{fromLink.err}</span> : "Paste the review link, or the review itself, as it came from the reviewer."}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea value={text} onChange={(e) => { setText(e.target.value); setErr(null) }} rows={6} placeholder="https://learning.sheilazhang.org/#/import/…  or  { &quot;target&quot;: … }" className="font-mono text-xs" data-testid="import-text" />

            {err ? <p className="text-destructive text-sm">{err}</p> : null}
            <div><Button onClick={addPasted} disabled={!text.trim()} data-testid="import-paste-add"><Inbox /> Add</Button></div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
