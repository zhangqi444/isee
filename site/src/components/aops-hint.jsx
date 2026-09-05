import * as React from "react"
import { BookOpen, ExternalLink } from "lucide-react"

import { ALCUMUS_URL, VIDEO_URL, aopsFor } from "@/lib/aops"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** "Where to relearn this": the AoPS chapter for a weak maths skill.
 *  `inline` is the one-line form used inside a table row. */
export function AopsHint({ sub, skill, inline, className }) {
  const a = aopsFor(sub, skill)
  if (!a) return null
  if (inline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={ALCUMUS_URL} target="_blank" rel="noreferrer"
            className={cn("text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs", className)}
            data-testid="aops-hint" data-skill={skill}
          >
            <BookOpen className="size-3" /> {a.ba.split(" · ")[0]} · {a.pa}
          </a>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">
          <span className="font-medium">{a.why}</span>
          <br />Beast Academy {a.ba}{a.ba2 ? ` · ${a.ba2}` : ""}
          <br />Prealgebra: {a.pa} (free videos)
          <br />Alcumus focus topic: {a.alcumus}
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <div className={cn("bg-muted/40 flex flex-col gap-1.5 rounded-md border p-3 text-sm", className)} data-testid="aops-hint" data-skill={skill}>
      <div className="flex items-center gap-2 font-medium"><BookOpen className="size-4" /> Relearn it in AoPS</div>
      <div className="text-muted-foreground">{a.why}</div>
      <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
        <li><span className="text-foreground font-medium">Beast Academy</span> — {a.ba}{a.ba2 ? `; ${a.ba2}` : ""}</li>
        <li><span className="text-foreground font-medium">Prealgebra</span> — {a.pa} chapter</li>
        <li><span className="text-foreground font-medium">Alcumus</span> — focus topic “{a.alcumus}”</li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <a href={ALCUMUS_URL} target="_blank" rel="noreferrer"><Badge variant="outline" className="font-normal">Alcumus <ExternalLink className="size-3" /></Badge></a>
        <a href={VIDEO_URL} target="_blank" rel="noreferrer"><Badge variant="outline" className="font-normal">Prealgebra videos <ExternalLink className="size-3" /></Badge></a>
      </div>
    </div>
  )
}
