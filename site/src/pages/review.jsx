import * as React from "react"
import { Play, Sparkles } from "lucide-react"

import { ORDER, SUBJ, allWrong } from "@/lib/content"
import { go } from "@/lib/router"
import { useStore } from "@/lib/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function Review() {
  useStore()
  const w = allWrong()
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Review</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Questions you missed, gathered from every set. Get one right here and it leaves the list.
        </p>
      </div>
      {!w.length ? (
        <Card className="items-center py-12 text-center" data-testid="review-empty">
          <CardHeader className="items-center">
            <Sparkles className="text-primary mb-2 size-8" />
            <CardTitle>Nothing waiting</CardTitle>
            <CardDescription>Finish a set and anything you miss collects here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => go("/")}>Back to dashboard</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
          {ORDER.map((s) => {
            const mine = w.filter((x) => x.sub === s)
            if (!mine.length) return null
            const skills = {}
            mine.forEach((x) => { if (x.it.sk) skills[x.it.sk] = (skills[x.it.sk] || 0) + 1 })
            const top = Object.entries(skills).sort((a, b) => b[1] - a[1]).slice(0, 3)
            return (
              <Card key={s} className="gap-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full" style={{ background: SUBJ[s].color }} />
                    {SUBJ[s].name}
                  </CardTitle>
                  <CardDescription>{mine.length} question{mine.length === 1 ? "" : "s"} to try again</CardDescription>
                  <CardAction><Badge variant="warning" className="tabular-nums">{mine.length}</Badge></CardAction>
                </CardHeader>
                {top.length ? (
                  <CardContent className="flex flex-wrap gap-1.5">
                    {top.map(([sk, n]) => <Badge key={sk} variant="outline" className="font-normal">{sk} · {n}</Badge>)}
                  </CardContent>
                ) : null}
                <CardContent>
                  <Button size="sm" onClick={() => go("/review/" + s)}><Play /> Start review</Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
