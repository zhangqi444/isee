import * as React from "react"
import { Check, CloudOff, GraduationCap, HardDrive, Loader2, RefreshCw, ShieldCheck } from "lucide-react"

import { DRIVE_ENABLED, Store, useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Google's mark, so the button looks like every other Google sign-in. */
function GoogleMark({ className }) {
  return (
    <svg viewBox="0 0 18 18" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  )
}

/**
 * The welcome / sign-in dialog, modelled on zhangqi444/volunteer.
 * It is an invitation, not a gate: the site works signed out, so "Not now" is a
 * real answer and is remembered. It comes back only when the Drive session has
 * lapsed in a way a silent refresh could not fix.
 */
export function SignInDialog() {
  const store = useStore()
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState("")

  const asked = !!store.s.signInAsked
  const granted = !!store.s.driveGranted
  const status = store.status
  // First visit: invite her in. Later: only when the session actually needs a click.
  const reason = !DRIVE_ENABLED ? null
    : !granted && !asked ? "welcome"
      : granted && store.reconnectNeeded && !store.reconnectDismissed ? "reconnect"
        : null
  const open = !!reason

  function close() {
    if (reason === "welcome") Store.dismissSignIn()
    else Store.reconnectDismissed = true
    Store.setStatus(Store.status)   // re-render
  }

  function connect() {
    setBusy(true); setErr("")
    Store.signIn()
      .then(() => { Store.dismissSignIn() })
      .catch((e) => setErr(String((e && e.message) || e)))
      .finally(() => setBusy(false))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent className="sm:max-w-md" data-testid="signin-dialog" data-reason={reason || ""}>
        <DialogHeader>
          <div className="bg-primary/10 text-primary mx-auto mb-1 flex size-11 items-center justify-center rounded-xl sm:mx-0">
            {reason === "reconnect" ? <RefreshCw className="size-5" /> : <GraduationCap className="size-5" />}
          </div>
          <DialogTitle>{reason === "reconnect" ? "Reconnect Google Drive" : "Sheila's ISEE practice"}</DialogTitle>
          <DialogDescription>
            {reason === "reconnect"
              ? "The Google session has lapsed. Her work is safe on this device — reconnecting starts saving it to Drive again."
              : "Sign in with Google and her progress is kept in your own Drive, so it follows her between the laptop and the iPad."}
          </DialogDescription>
        </DialogHeader>

        {reason === "welcome" ? (
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            <li className="flex items-start gap-2"><ShieldCheck className="text-success mt-0.5 size-4 shrink-0" /> One file in a folder this site creates. It cannot see anything else in your Drive.</li>
            <li className="flex items-start gap-2"><Check className="text-success mt-0.5 size-4 shrink-0" /> Answers, essays and streaks sync between her devices.</li>
            <li className="flex items-start gap-2"><HardDrive className="mt-0.5 size-4 shrink-0" /> You can skip this — everything still works, saved in this browser only.</li>
          </ul>
        ) : null}

        {err ? (
          <p className="text-destructive flex items-start gap-2 text-sm" data-testid="signin-error"><CloudOff className="mt-0.5 size-4 shrink-0" /> {err}</p>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start">
          <Button onClick={connect} disabled={busy} data-testid="signin-google" className="w-full gap-2 sm:w-auto">
            {busy ? <Loader2 className="animate-spin" /> : <GoogleMark className="size-4" />}
            {busy ? "Opening Google…" : reason === "reconnect" ? "Reconnect" : "Sign in with Google"}
          </Button>
          <Button variant="ghost" onClick={close} disabled={busy} data-testid="signin-skip" className="w-full sm:w-auto">
            {reason === "reconnect" ? "Later" : "Not now — this device only"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
