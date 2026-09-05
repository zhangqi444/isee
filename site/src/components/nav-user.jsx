import * as React from "react"
import { Cloud, CloudOff, HardDrive, LogOut, MonitorSmartphone, Moon, MoreVertical, RefreshCw, Sun } from "lucide-react"

import { DRIVE_ENABLED, useStore } from "@/lib/store"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"

export const STATUS_LABEL = {
  local: "Saved on this device",
  connecting: "Connecting to Google…",
  syncing: "Syncing with Drive…",
  live: "Saved to Google Drive",
  expired: "Drive session expired — reconnect",
  error: "Drive sync failed",
  unavailable: "Drive unavailable here",
}

export function NavUser() {
  const store = useStore()
  const { isMobile } = useSidebar()
  const status = DRIVE_ENABLED ? store.status : "local"
  const live = status === "live"
  const name = live ? (store.name || store.email || "Signed in") : "Sheila"
  const sub = live && store.email && store.name ? store.email : STATUS_LABEL[status]
  const initial = name.slice(0, 1).toUpperCase()
  const theme = store.s.theme || "system"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg">
                {live && store.picture ? <AvatarImage src={store.picture} alt="" referrerPolicy="no-referrer" /> : null}
                <AvatarFallback className="rounded-lg bg-primary/15 text-primary font-semibold">{initial}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="text-muted-foreground truncate text-xs">{sub}</span>
              </div>
              <MoreVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {live && store.picture ? <AvatarImage src={store.picture} alt="" referrerPolicy="no-referrer" /> : null}
                  <AvatarFallback className="rounded-lg bg-primary/15 text-primary font-semibold">{initial}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">{sub}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {DRIVE_ENABLED ? (
                live ? (
                  <>
                    <DropdownMenuItem onSelect={() => store.push().then(() => store.setStatus("live")).catch(() => store.setStatus("error"))}>
                      <RefreshCw /> Sync now
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => store.signOut()}>
                      <LogOut /> Disconnect Drive
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onSelect={() => store.signIn().catch(() => {})} disabled={status === "connecting" || status === "syncing"}>
                    {status === "error" ? <CloudOff /> : <Cloud />}
                    {status === "error" ? "Retry Google Drive" : status === "expired" ? "Reconnect Google Drive" : "Save to Google Drive"}
                  </DropdownMenuItem>
                )
              ) : (
                <DropdownMenuItem disabled>
                  <HardDrive /> Progress stays in this browser
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => store.setTheme(v === "system" ? undefined : v)}>
              <DropdownMenuRadioItem value="light"><Sun /> Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark"><Moon /> Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system"><MonitorSmartphone /> System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
