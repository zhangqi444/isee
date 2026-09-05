import * as React from "react"
import { BookMarked, BookOpen, Check, ChevronRight, Highlighter, Library, Plus, RotateCcw, Star, Trash2, X } from "lucide-react"

import { fmtDate } from "@/lib/content"
import {
  addBook, addWord, books, currentBook, finishBook, finishedBooks, logSession, progressOf, rateBook,
  readToday, readingDays, removeBook, removeWord, reopenBook, setPages, shelf, startBook, suggestions,
  undoSession, wordsCollected,
} from "@/lib/books"
import { syncBadges } from "@/lib/rewards"
import { go } from "@/lib/router"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const today = () => new Date().toISOString().slice(0, 10)

function Stars({ value, onPick }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => onPick(n)} data-testid={`star-${n}`}>
          <Star className={cn("size-4", value >= n ? "fill-warning text-warning" : "text-muted-foreground/40")} />
        </button>
      ))}
    </span>
  )
}

/** Where she got to, and the words she picked up along the way. */
function BookRow({ b, open, onToggle }) {
  const pct = progressOf(b)
  const done = b.status === "finished"
  const [word, setWord] = React.useState("")
  const [page, setPage] = React.useState("")
  const readOn = (b.sessions || []).some((s) => s.on === today())
  function log() { logSession(b.id, { page: page || null }); setPage(""); syncBadges() }
  function finish() { finishBook(b.id); syncBadges() }
  return (
    <li className="flex flex-col gap-3 px-4 py-3" data-testid="book" data-status={b.status} data-id={b.id}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md", done ? "bg-success-soft text-success" : b.status === "reading" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          {done ? <Check className="size-4" /> : b.status === "reading" ? <BookOpen className="size-4" /> : <Library className="size-4" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <button type="button" className="text-left text-sm font-medium hover:underline" onClick={onToggle}>{b.title}</button>
          <span className="text-muted-foreground text-xs">
            {b.author || "—"}
            {done ? (b.finishedAt ? ` · finished ${fmtDate(b.finishedAt)}` : " · finished before the log started") : ""}
            {!done && pct != null ? ` · page ${b.page} of ${b.pages}` : ""}
            {!done && pct == null && (b.sessions || []).length ? ` · read on ${(b.sessions || []).length} day${(b.sessions || []).length === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        {done ? <Stars value={b.rating || 0} onPick={(n) => rateBook(b.id, n)} /> : null}
        {b.status === "want" ? <Button size="sm" variant="outline" onClick={() => startBook(b.id)} data-testid={`start-${b.id}`}>Start reading</Button> : null}
        {b.status === "reading" ? (
          <Button size="sm" variant={readOn ? "secondary" : "default"} onClick={log} data-testid={`log-${b.id}`}>
            {readOn ? <><Check /> Read today</> : "I read today"}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onToggle} aria-label="Details"><ChevronRight className={cn("transition-transform", open && "rotate-90")} /></Button>
      </div>
      {pct != null && !done ? <Progress value={pct} className="h-1.5" /> : null}

      {open ? (
        <div className="flex flex-col gap-3 rounded-md border p-3" data-testid="book-detail">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Page she's on</span>
              <Input type="number" min="0" value={b.page ?? ""} onChange={(e) => setPages(b.id, null, e.target.value)} className="h-8 w-24 tabular-nums" data-testid="page-now" />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Pages in the book</span>
              <Input type="number" min="1" value={b.pages ?? ""} onChange={(e) => setPages(b.id, e.target.value, null)} className="h-8 w-24 tabular-nums" placeholder="—" data-testid="page-total" />
            </label>
            {b.status === "reading" ? (
              <>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Log today up to page</span>
                  <Input type="number" min="0" value={page} onChange={(e) => setPage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") log() }} className="h-8 w-28 tabular-nums" placeholder="optional" />
                </label>
                <Button size="sm" variant="outline" onClick={log}>Log</Button>
                <Button size="sm" onClick={finish} data-testid={`finish-${b.id}`}><Check /> Finished it</Button>
              </>
            ) : null}
            {done ? <Button size="sm" variant="outline" onClick={() => reopenBook(b.id)}><RotateCcw /> Still reading</Button> : null}
            <span className="flex-1" />
            <Button size="icon-sm" variant="ghost" aria-label="Remove book" onClick={() => removeBook(b.id)}><Trash2 /></Button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs"><Highlighter className="size-3.5" /> Words she looked up in this book</span>
            {(b.words || []).length ? (
              <div className="flex flex-wrap gap-1.5">
                {(b.words || []).map((w) => (
                  <Badge key={w.w} variant="secondary" className="font-normal" data-testid="book-word">
                    {w.w}
                    <button type="button" className="ml-1 opacity-60 hover:opacity-100" aria-label={`Remove ${w.w}`} onClick={() => removeWord(b.id, w.w)}><X className="size-3" /></button>
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                value={word} onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addWord(b.id, word); setWord(""); syncBadges() } }}
                placeholder="A word she had to look up" className="h-8 max-w-64" data-testid="word-add"
              />
              <Button size="sm" variant="outline" onClick={() => { addWord(b.id, word); setWord(""); syncBadges() }}><Plus /> Add</Button>
            </div>
          </div>

          {(b.sessions || []).length ? (
            <div className="flex flex-wrap gap-1.5">
              {(b.sessions || []).slice(-14).reverse().map((s) => (
                <Tooltip key={s.on}>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground rounded border px-1.5 py-0.5 text-xs tabular-nums" onClick={() => undoSession(b.id, s.on)}>
                      {new Date(s.on + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}{s.page ? ` · p${s.page}` : ""}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Click to undo this day</TooltipContent>
                </Tooltip>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/** Dashboard card: the book she is on, one tap to log today. */
export function ReadingCard() {
  useStore()
  const cur = currentBook()
  const done = finishedBooks().length
  const days = readingDays().size
  const pct = cur ? progressOf(cur) : null
  const readOn = readToday()
  return (
    <Card className="gap-4" data-testid="reading-card">
      <CardHeader>
        <CardDescription className="flex items-center gap-2"><BookMarked className="size-4" /> Reading</CardDescription>
        <CardTitle className="text-xl">{cur ? cur.title : "No book on the go"}</CardTitle>
        <CardDescription>{cur ? `${cur.author || ""}${pct != null ? ` · page ${cur.page} of ${cur.pages}` : ""}` : "Reading is the slowest and strongest way to lift Reading and Verbal."}</CardDescription>
        <CardAction><Button size="sm" variant="ghost" onClick={() => go("/books")}>Shelf <ChevronRight /></Button></CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {pct != null ? <Progress value={pct} className="h-1.5" /> : null}
        <div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs tabular-nums">
          <span>{done} book{done === 1 ? "" : "s"} finished</span>
          <span>{days} reading day{days === 1 ? "" : "s"}</span>
          {wordsCollected() ? <span>{wordsCollected()} words caught</span> : null}
        </div>
        {cur ? (
          <Button size="sm" variant={readOn ? "secondary" : "default"} className="self-start" onClick={() => { logSession(cur.id); syncBadges() }} data-testid="reading-log">
            {readOn ? <><Check /> Read today</> : "I read today"}
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="self-start" onClick={() => go("/books")}>Pick a book</Button>
        )}
      </CardContent>
    </Card>
  )
}

export function Books() {
  useStore()
  React.useEffect(() => { syncBadges() })
  const list = shelf()
  const [open, setOpen] = React.useState(() => { const c = currentBook(); return c ? c.id : null })
  const [title, setTitle] = React.useState("")
  const [author, setAuthor] = React.useState("")
  const done = finishedBooks().length
  const days = readingDays().size
  const already = new Set(books().map((b) => b.title.toLowerCase()))
  function add(status) {
    const id = addBook({ title, author, status })
    if (id) { setTitle(""); setAuthor(""); setOpen(id) }
  }
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <Card className="from-primary/5 to-card bg-gradient-to-t gap-4">
        <CardHeader>
          <CardDescription className="flex items-center gap-2"><Library className="size-4" /> Reading</CardDescription>
          <CardTitle className="text-2xl font-semibold tracking-tight">What Sheila is reading</CardTitle>
          <CardDescription>
            Independent reading does more for Reading Comprehension and Verbal Reasoning than any drill — it is just slower to show up. Tap “I read today” on the book she is on; reading days count toward the streak and earn points like everything else.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><span className="text-2xl font-semibold tabular-nums" data-testid="books-done">{done}</span> <span className="text-muted-foreground">finished</span></span>
          <span><span className="text-2xl font-semibold tabular-nums">{days}</span> <span className="text-muted-foreground">reading day{days === 1 ? "" : "s"}</span></span>
          <span><span className="text-2xl font-semibold tabular-nums">{wordsCollected()}</span> <span className="text-muted-foreground">words caught</span></span>
        </CardContent>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">The shelf</CardTitle>
          <CardDescription>Reading first, then the list she wants to get to, then finished.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y">
            {list.map((b) => <BookRow key={b.id} b={b} open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)} />)}
          </ul>
        </CardContent>
        <CardFooter className="flex-wrap gap-2 px-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add("reading") }} placeholder="Title" className="h-9 min-w-44 flex-1" data-testid="book-title" />
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" className="h-9 w-40" data-testid="book-author" />
          <Button variant="outline" onClick={() => add("reading")} data-testid="book-add"><Plus /> Reading now</Button>
          <Button variant="ghost" onClick={() => add("want")}>Add to the list</Button>
        </CardFooter>
      </Card>

      <Card className="gap-2 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-base">What to read next</CardTitle>
          <CardDescription>Well-known books chosen for the reading skills the ISEE asks about. One tap puts one on the list.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-4">
          {suggestions().filter((s) => !already.has(s.title.toLowerCase())).map((s) => (
            <div key={s.title} className="flex flex-wrap items-start gap-3 rounded-md border p-3" data-testid="suggestion">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{s.title} <span className="text-muted-foreground font-normal">· {s.author}</span></span>
                <span className="text-muted-foreground text-xs">{s.why}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => addBook({ title: s.title, author: s.author, status: "want" })}><Plus /> Add</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
