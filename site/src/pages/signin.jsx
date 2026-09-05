import * as React from "react"
import { BookOpenCheck, Check, CloudOff, GraduationCap, Loader2, ShieldCheck, Smartphone } from "lucide-react"

import { DRIVE_ENABLED, Store, useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"

function GoogleMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/** Shown while a stored session is being refreshed, so the sign-in page never flashes. */
export function Splash() {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center" data-testid="splash">
      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <Loader2 className="size-4 animate-spin" /> Signing back in…
      </div>
    </div>
  )
}

/**
 * The gate. Nothing else in the app renders until Google says who this is —
 * the same shape as zhangqi444/volunteer's auth screen.
 */
export function SignIn() {
  const store = useStore()
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState("")
  const returning = !!store.s.driveGranted

  function connect() {
    setBusy(true); setErr("")
    Store.signIn()
      .catch((e) => setErr(String((e && e.message) || e)))
      .finally(() => setBusy(false))
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-6" data-testid="signin-page">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <GraduationCap className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Sheila · ISEE</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {returning ? "Welcome back." : "Everything for the ISEE, in one place."}
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            {returning
              ? "Sign in again to pick up where she left off. Her work is in your Google Drive, exactly as she left it."
              : "Practice sets, the review pile, precision words, essays and full mock exams — with her progress kept in your own Google Drive."}
          </p>
        </div>

        <ul className="flex flex-col gap-2.5 text-sm">
          <li className="flex items-start gap-2.5"><ShieldCheck className="text-success mt-0.5 size-4 shrink-0" /><span>Her work is saved as one file in <strong>your own Google Drive</strong>. There is no server and no account to create.</span></li>
          <li className="flex items-start gap-2.5"><Check className="text-success mt-0.5 size-4 shrink-0" /><span>The site can only see the folder it creates — nothing else in your Drive.</span></li>
          <li className="flex items-start gap-2.5"><Smartphone className="text-success mt-0.5 size-4 shrink-0" /><span>Sign in on the laptop or the iPad and it is the same practice, in step.</span></li>
        </ul>

        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={connect} disabled={busy} className="w-full gap-3" data-testid="signin-google">
            {busy ? <Loader2 className="animate-spin" /> : <GoogleMark className="size-[18px]" />}
            {busy ? "Waiting for Google…" : "Sign in with Google"}
          </Button>
          {err ? (
            <p className="text-destructive flex items-start gap-2 text-sm" data-testid="signin-error">
              <CloudOff className="mt-0.5 size-4 shrink-0" /> {err}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs leading-relaxed">
            Signing in opens a Google window asking to see your name and email, and to manage the files this site creates in Drive. You can disconnect at any time from the account menu.
          </p>
        </div>

        <div className="text-muted-foreground flex items-center gap-2 border-t pt-4 text-xs">
          <BookOpenCheck className="size-3.5 shrink-0" />
          ISEE Lower Level · eight-week plan · {DRIVE_ENABLED ? "your work stays in your Drive" : "offline copy"}
        </div>
      </div>
    </div>
  )
}
