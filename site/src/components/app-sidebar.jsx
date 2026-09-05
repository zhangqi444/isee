import * as React from "react"
import { Award, BookA, BookMarked, BookOpen, Calculator, CalendarDays, GraduationCap, LayoutDashboard, ListChecks, PenLine, Play, RotateCcw, Shuffle, Sigma, Timer, Trophy } from "lucide-react"

import { D, ORDER, SUBJ, subjProgress } from "@/lib/content"
import { reviewQueue } from "@/lib/engine"
import { recentBadges } from "@/lib/rewards"
import { currentBook, finishedBooks } from "@/lib/books"
import { nextUp, weekLeft } from "@/pages/checklist"
import { essayStatus } from "@/pages/essay"
import { go } from "@/lib/router"
import { useStore } from "@/lib/store"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"

const ICON = { vr: BookA, qr: Sigma, ma: Calculator, rc: BookOpen }

/** Navigates and closes the drawer on phones. */
function useNav() {
  const { isMobile, setOpenMobile } = useSidebar()
  return (path) => { go(path); if (isMobile) setOpenMobile(false) }
}

export function AppSidebar({ route, ...props }) {
  useStore()
  const nav = useNav()
  const misses = reviewQueue().due.length
  const fresh = recentBadges(3).length
  const week = weekLeft()
  const next = nextUp()
  const essayDone = D.weeks.filter((w) => essayStatus(w.w) === "complete").length
  const top = route[0] || ""
  const activeSub = top === "s" || top === "run" ? route[1] : top === "precision" ? "vr" : null

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="#/" onClick={(e) => { e.preventDefault(); nav("/") }}>
                <GraduationCap className="!size-5 text-primary" />
                <span className="text-base font-semibold tracking-tight">Sheila · ISEE</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip={next ? "Next: " + next.label : "Everything in the plan is done"}
                  onClick={() => nav(next ? next.path : "/")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear"
                  data-testid="continue-practice"
                >
                  <Play className="shrink-0" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="font-medium">{next ? "Continue" : "All done"}</span>
                    <span className="truncate text-xs opacity-80">{next ? next.label : "nothing left in the plan"}</span>
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Dashboard" isActive={top === ""} onClick={() => nav("/")}>
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={week.left ? `${week.left} of ${week.total} still to do this week` : "This week is clear"} isActive={top === "checklist"} onClick={() => nav("/checklist")}>
                  <ListChecks />
                  <span>Checklist</span>
                </SidebarMenuButton>
                {week.left ? <SidebarMenuBadge className="bg-warning-soft text-warning rounded-full h-5 min-w-5 px-1.5" data-testid="week-left">{week.left}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Review" isActive={top === "review"} onClick={() => nav("/review")}>
                  <RotateCcw />
                  <span>Review</span>
                </SidebarMenuButton>
                {misses ? (
                  <SidebarMenuBadge className="bg-destructive text-white rounded-full h-5 min-w-5 px-1.5">{misses}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Mixed practice" isActive={top === "mixed"} onClick={() => nav("/mixed")}>
                  <Shuffle />
                  <span>Mixed practice</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Score" isActive={top === "score"} onClick={() => nav("/score")}>
                  <Trophy />
                  <span>Score</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Rewards" isActive={top === "rewards"} onClick={() => nav("/rewards")}>
                  <Award />
                  <span>Rewards</span>
                </SidebarMenuButton>
                {fresh ? <SidebarMenuBadge className="pointer-events-none" data-testid="rewards-new"><span className="bg-primary size-2 rounded-full" title={`${fresh} new badge${fresh === 1 ? "" : "s"}`} /></SidebarMenuBadge> : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Mock exams" isActive={top === "mock"} onClick={() => nav("/mock")}>
                  <Timer />
                  <span>Mock exams</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Calendar" isActive={top === "calendar"} onClick={() => nav("/calendar")}>
                  <CalendarDays />
                  <span>Calendar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Subjects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ORDER.map((s) => {
                const Icon = ICON[s]
                const p = subjProgress(s)
                return (
                  <SidebarMenuItem key={s}>
                    <SidebarMenuButton tooltip={SUBJ[s].name} isActive={activeSub === s} onClick={() => nav("/s/" + s)}>
                      <Icon />
                      <span>{SUBJ[s].name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="text-muted-foreground">{p.done}/{p.total}</SidebarMenuBadge>
                  </SidebarMenuItem>
                )
              })}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Essay" isActive={top === "essay"} onClick={() => nav("/essay")}>
                  <PenLine />
                  <span>Essay</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="text-muted-foreground">{essayDone}/{D.weeks.length}</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={currentBook() ? "Reading · " + currentBook().title : "Reading"} isActive={top === "books"} onClick={() => nav("/books")}>
                  <BookMarked />
                  <span>Reading</span>
                </SidebarMenuButton>
                {finishedBooks().length ? <SidebarMenuBadge className="text-muted-foreground">{finishedBooks().length}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
