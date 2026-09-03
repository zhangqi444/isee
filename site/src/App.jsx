import * as React from "react"

import { SUBJ, allWrong, setId, setsFor } from "@/lib/content"
import { useRoute } from "@/lib/router"
import { useStore } from "@/lib/store"
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
              <Screen route={route} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
