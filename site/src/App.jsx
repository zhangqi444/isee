import * as React from "react"

import { SUBJ, allWrong, setId, setsFor } from "@/lib/content"
import { useRoute } from "@/lib/router"
import { Store, useStore } from "@/lib/store"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Home } from "@/pages/home"
import { Subject } from "@/pages/subject"
import { Runner } from "@/pages/runner"
import { Review } from "@/pages/review"

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
  if (top === "review" && SUBJ[a]) {
    const items = allWrong().filter((x) => x.sub === a).map((x) => x.it)
    if (items.length) {
      return (
        <Runner
          key={`rev:${a}:${items.length}`}
          items={items}
          custom
          title={`${SUBJ[a].name} · Review`}
          exitPath="/review"
          exitLabel="Back to review"
        />
      )
    }
    return <Review />
  }
  if (top === "review") return <Review />
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
        <h2 className="font-serif text-xl font-semibold">Something went wrong</h2>
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
  useStore()
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
