import * as React from "react"
import { BookA, CheckCircle2, Eye, EyeOff, ListChecks, RotateCcw, Send } from "lucide-react"

import { D, weekLabel } from "@/lib/content"
import { scheduleWord, wordStatus, wordSummary } from "@/lib/engine"
import { go } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

const CONF = [
  { v: 1, label: "1 · shaky", hint: "I guessed or am not sure" },
  { v: 2, label: "2 · okay", hint: "Mostly right, some doubt" },
  { v: 3, label: "3 · sure", hint: "I could teach this word" },
]

/** Per-week state: { words: { [word]: {text, conf, at} }, submittedAt, at } */
export function precisionState(wk) { return Store.s.precision[wk] || { words: {} } }
export function precisionSummary(wk) {
  const st = precisionState(wk), list = (D.precision[wk] || { words: [] }).words
  let written = 0, due = 0
  for (const w of list) {
    const r = st.words[w.word]
    if (r && r.text) written++
    if (st.submittedAt && (!r || !r.text || !r.conf || r.conf <= 1)) due++
  }
  return { total: list.length, written, due, submitted: !!st.submittedAt, submittedAt: st.submittedAt }
}

function WordCard({ wk, entry, idx, state, submitted }) {
  const r = state.words[entry.word] || {}
  const [text, setText] = React.useState(r.text || "")
  const [open, setOpen] = React.useState(false)
  const timer = React.useRef(null)
  React.useEffect(() => { setText(r.text || "") }, [r.text])

  function save(next) {
    Store.setSlice("precision", wk, (cur) => {
      const words = { ...(cur.words || {}) }
      words[entry.word] = { ...(words[entry.word] || {}), ...next, at: new Date().toISOString() }
      return { ...cur, words }
    })
    if (next.conf) scheduleWord(entry.word, next.conf)   // 1 → review tomorrow, 2 → in three days, 3 → quiz only
  }
  const ws = wordStatus(entry.word)
  function onText(v) {
    setText(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save({ text: v }), 500)
  }
  const due = submitted && (!r.text || !r.conf || r.conf <= 1)
  const mastered = submitted && r.text && r.conf >= 2

  return (
    <Card className={cn("gap-4 py-5", due && "border-warning/60", mastered && "border-success/40")} data-testid="pword">
      <CardHeader className="px-5">
        <CardTitle className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-muted-foreground text-xs font-normal tabular-nums">#{idx + 1}</span>
          <span className="text-xl font-semibold">{entry.word}</span>
          {entry.pos ? <span className="text-muted-foreground text-xs font-normal">{entry.pos}</span> : null}
        </CardTitle>
        <CardDescription className="text-foreground/80 text-[15px]">{entry.task}</CardDescription>
        <CardAction>
          {due ? <Badge variant="warning"><RotateCcw /> {!r.text ? "Not answered" : !r.conf ? "Needs a rating" : "Review due"}</Badge>
            : ws.status === "known" ? <Badge variant="success" data-testid="word-known"><CheckCircle2 /> Known</Badge>
            : ws.status === "due" || ws.status === "brushup" ? <Badge variant="warning" data-testid="word-due"><RotateCcw /> {ws.status === "brushup" ? "Brush-up due" : "Quiz due"}</Badge>
            : mastered ? <Badge variant="secondary" data-testid="word-learning">Explained · quiz next</Badge> : null}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-5">
        <Textarea
          value={text}
          onChange={(e) => onText(e.target.value)}
          onBlur={() => { clearTimeout(timer.current); if (text !== (r.text || "")) save({ text }) }}
          placeholder="Write your answer in your own words…"
          className="min-h-20"
          aria-label={`Your response for ${entry.word}`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Confidence</span>
          {CONF.map((c) => (
            <Button key={c.v} size="sm" variant={r.conf === c.v ? "default" : "outline"} title={c.hint} onClick={() => save({ conf: c.v })} data-testid={`conf-${c.v}`}>
              {c.label}
            </Button>
          ))}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} data-testid="reveal">
            {open ? <EyeOff /> : <Eye />} {open ? "Hide meaning" : "Check meaning"}
          </Button>
        </div>
        {open && (
          <div className="bg-muted/60 flex flex-col gap-1.5 rounded-md p-3 text-sm leading-relaxed" data-testid="meaning">
            <div><span className="text-muted-foreground">Meaning: </span><span className="font-medium">{entry.meaning}</span></div>
            {entry.example ? <div><span className="text-muted-foreground">Example: </span><em>{entry.example}</em></div> : null}
            {entry.usage ? <div><span className="text-muted-foreground">Note: </span>{entry.usage}</div> : null}
            {entry.connotation ? <div><span className="text-muted-foreground">Feel: </span>{entry.connotation}</div> : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function Precision({ wk }) {
  useStore()
  const data = D.precision[wk]
  if (!data) return null
  const state = precisionState(wk)
  const sum = precisionSummary(wk)
  const ws = wordSummary(wk)
  const ready = data.words.every((w) => { const r = state.words[w.word]; return r && r.text && r.conf })

  function submit() {
    Store.setSlice("precision", wk, (cur) => ({ ...cur, submittedAt: new Date().toISOString() }))
    window.scrollTo(0, 0)
  }
  function reopen() { Store.setSlice("precision", wk, (cur) => ({ ...cur, submittedAt: null })) }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><BookA className="size-4" /> Verbal Reasoning · {wk} · {weekLabel(wk)}</CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-tight">Session 1 — Precision Review</CardTitle>
          <CardDescription>{data.minutes}. Explain each word in your own words, rate how sure you are, then check the meaning. Submit the whole set once every word has an answer and a rating. A word counts as <em>known</em> once it is explained here and answered right in the synonym quiz on a different day.</CardDescription>
          <CardAction>
            {sum.submitted ? <Badge variant="success"><CheckCircle2 /> Submitted</Badge> : <Badge variant="secondary" className="tabular-nums">{sum.written}/{sum.total} written</Badge>}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress value={(sum.written / sum.total) * 100} className="h-1.5" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => go(`/precision/${wk}/quiz`)} data-testid="word-quiz"><ListChecks /> Word quiz · synonyms{ws.due + ws.brushup ? ` (${ws.due + ws.brushup} due)` : ""}</Button>
            <span className="text-muted-foreground text-xs">Four choices per word, ISEE style. Best done a day after writing the explanations.</span>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 text-sm tabular-nums">
            <span>{sum.written} of {sum.total} answered</span>
            {sum.submitted && <span>{sum.due} to rate or review</span>}
            <span data-testid="word-summary">{ws.known} known · {ws.learning + ws.new} learning{ws.due + ws.brushup ? ` · ${ws.due + ws.brushup} quiz due` : ""}</span>
            {sum.submittedAt && <span>submitted {new Date(sum.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {data.words.map((w, i) => <WordCard key={w.word} wk={wk} entry={w} idx={i} state={state} submitted={sum.submitted} />)}
      </div>

      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 z-10 -mx-4 -mb-4 mt-2 flex items-center gap-3 border-t px-4 py-3 backdrop-blur md:-mx-6 md:-mb-6 md:px-6">
        <Button variant="outline" onClick={() => go("/s/vr/" + wk)}>Back to {wk}</Button>
        <span className="text-muted-foreground hidden flex-1 text-sm sm:block">
          {sum.submitted ? "Submitted. Words rated 1, unrated, or left blank are due for review — rate the ones from the sheet to clear them." : ready ? "Every word has an answer and a rating." : `${sum.total - sum.written} left to answer, then rate each one.`}
        </span>
        <span className="flex-1 sm:hidden" />
        {sum.submitted ? (
          <Button variant="secondary" onClick={reopen}>Reopen set</Button>
        ) : (
          <Button onClick={submit} disabled={!ready} data-testid="submit-precision"><Send /> Submit precision set</Button>
        )}
      </div>
    </div>
  )
}
