import * as React from "react"

import { D, SUBJ, setId, setsFor } from "@/lib/content"
import { reviewQueue, wordQuizItems } from "@/lib/engine"
import { useRoute } from "@/lib/router"
import { DRIVE_ENABLED, Store, useStore } from "@/lib/store"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SignIn, Splash } from "@/pages/signin"
import { Home } from "@/pages/home"
import { Subject } from "@/pages/subject"
import { Runner } from "@/pages/runner"
import { Review } from "@/pages/review"
import { Precision } from "@/pages/precision"
import { EssayList, EssayWeek } from "@/pages/essay"
import { MockCorrections, MockEssay, MockList, MockOverview, MockSection } from "@/pages/mock"
import { Calendar } from "@/pages/calendar"
import { Checklist } from "@/pages/checklist"
import { Mixed, MixedRun } from "@/pages/mixed"
import { Score } from "@/pages/score"
import { Rewards } from "@/pages/rewards"
import { Books } from "@/pages/books"
import { Import } from "@/pages/import"

/** The queue is read once on mount, so finishing the run (which reschedules every item) keeps the score screen up. */
function ReviewRun({ sub, mode }) {
  const items = React.useMemo(() => {
    const q = reviewQueue(sub)
    const rows = mode === "checkin" ? q.checkin : mode === "all" ? [...q.due, ...q.scheduled] : q.due
    return rows.map((x) => x.it)
  }, [sub, mode])
  if (!items.length) return <Review />
  return <Runner items={items} custom ctx="review" sub={sub} title={`${SUBJ[sub].name} · ${mode === "checkin" ? "Check-in" : "Review"}`} exitPath="/review" exitLabel="Back to review" />
}
function VocabRun({ wk }) {
  const items = React.useMemo(() => wordQuizItems(wk), [wk])
  if (!items.length) return <Precision key={wk} wk={wk} />
  return <Runner items={items} custom ctx="vocab" sub="vr" title={`Precision words · ${wk} · quiz`} exitPath={`/precision/${wk}`} exitLabel="Back to the words" />
}

function Screen({ route }) {
  const [top, a, b, c] = route
  if (top === "s" && SUBJ[a]) return <Subject sub={a} wk={b} />
  if (top === "run" && SUBJ[a]) {
    const n = +c
    const set = setsFor(a, b)[n]
    if (set) {
      return (
        <Runner
          key={`run:${a}:${b}:${n}`}
          items={set}
          setId={setId(a, b, n)}
          prior={Store.s.results[setId(a, b, n)] || null}
          title={`${SUBJ[a].name} · ${b} · Set ${n + 1}`}
          exitPath={`/s/${a}/${b}`}
          exitLabel="Back to sets"
        />
      )
    }
  }
  if (top === "review" && SUBJ[a]) return <ReviewRun key={`rev:${a}:${b || ""}`} sub={a} mode={b} />
  if (top === "review") return <Review />
  if (top === "precision" && a && D.precision[a] && b === "quiz") return <VocabRun key={"vocab:" + a} wk={a} />
  if (top === "precision" && a && D.precision[a]) return <Precision key={a} wk={a} />
  if (top === "mixed") return b === undefined && a === "run" ? <MixedRun key="mixed-run" /> : <Mixed />
  if (top === "score") return <Score />
  if (top === "rewards") return <Rewards />
  if (top === "books") return <Books />
  if (top === "essay" && a && D.essay.weeks[a]) return <EssayWeek key={a} wk={a} />
  if (top === "essay") return <EssayList />
  if (top === "mock" && a && D.mocks.some((m) => m.id === a)) {
    if (b === "corrections") return <MockCorrections form={a} />
    if (b === "ESSAY") return <MockEssay key={a} form={a} />
    if (b) return <MockSection key={a + b} form={a} sec={b} />
    return <MockOverview form={a} />
  }
  if (top === "mock") return <MockList />
  if (top === "calendar") return <Calendar />
  if (top === "checklist") return a === "month" ? <Checklist month={b} /> : <Checklist wk={a} />
  if (top === "import") return <Import key={a || ""} payload={a || ""} />
  return <Home />
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { console.error(err) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="mx-auto mt-16 flex max-w-md flex-col gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">{String(this.state.err && this.state.err.message || this.state.err)}</p>
        <div className="flex justify-center gap-2">
          <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => location.reload()}>Reload</button>
          <button className="rounded-md bg-destructive px-3 py-1.5 text-sm text-white" onClick={() => { if (confirm("Clear the progress saved in this browser? Anything already in Google Drive is kept.")) { localStorage.removeItem("isee.v1"); location.reload() } }}>Clear local data</button>
        </div>
      </div>
    )
  }
}

export default function App() {
  const route = useRoute()
  const store = useStore()
  // Nothing renders until Google has said who this is. The offline artifact build
  // has no Drive at all, so it is never gated.
  if (DRIVE_ENABLED) {
    if (store.booting) return <Splash />
    if (!store.signedIn()) return <SignIn />
  }
  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 68)", "--header-height": "calc(var(--spacing) * 12)" }}>
      <AppSidebar variant="inset" route={route} />
      <SidebarInset>
        <SiteHeader route={route} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-1 flex-col p-4 md:p-6">
              <ErrorBoundary key={route.join("/")}><Screen route={route} /></ErrorBoundary>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
