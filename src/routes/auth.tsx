import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRightIcon, LockKeyholeIcon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [
    { title: "Sign in to Mortagi" },
    { name: "description", content: "Sign in or create a Mortagi account for private conversations, image tools, and files." },
    { property: "og:title", content: "Sign in to Mortagi" },
    { property: "og:description", content: "Your personal Mortagi workspace for conversations, images, and files." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function AuthPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (ready && user) void navigate({ to: "/dashboard", replace: true });
  }, [ready, user, navigate]);

  async function resendConfirmation() {
    if (!email.trim()) {
      toast.error("Please enter your email address first.");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success("Confirmation link resent! Please check your inbox and spam folder.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend confirmation email.");
    } finally {
      setResending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmEmail(true);
          toast.info("Please verify your email to complete registration.");
        } else {
          toast.success("Your Mortagi account is ready.");
          await navigate({ to: "/dashboard" });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            setConfirmEmail(true);
            toast.error("Email not confirmed yet. Click resend below if you need a new link.");
            return;
          }
          throw error;
        }
        await navigate({ to: "/dashboard" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't complete that request.");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google") {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) {
        if (error.message.toLowerCase().includes("not enabled") || error.message.toLowerCase().includes("unsupported provider")) {
          toast.error("Google login is not enabled in your Supabase project. Go to Supabase > Authentication > Providers > Google to enable it.");
          return;
        }
        throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-border bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-xl font-semibold"><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">M</span>Mortagi</div>
        <div className="max-w-xl pb-12">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground">A little more room to think</p>
          <h1 className="font-display text-5xl font-semibold leading-tight">Your ideas, in good company.</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">Conversations, image-making, and the files that help you get there — all in one private space.</p>
        </div>
        <p className="text-sm text-muted-foreground">A personal workspace that stays yours.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-3 text-xl font-semibold lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">M</span>Mortagi</div>
          {confirmEmail ? (
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-semibold">Verify your email</h2>
              <p className="leading-relaxed text-muted-foreground">
                We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click the link in your email to activate your account.
              </p>
              <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                💡 <strong>Tip:</strong> If you don't see the email, please check your <strong>Spam / Junk</strong> folder or click the button below.
              </p>
              <div className="space-y-2 pt-2">
                <Button
                  className="w-full"
                  disabled={resending}
                  onClick={() => void resendConfirmation()}
                >
                  {resending ? "Sending link…" : "Resend confirmation email"}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setConfirmEmail(false);
                    setMode("signin");
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-display text-3xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
              <p className="mt-2 text-muted-foreground">{mode === "signin" ? "Pick up where your ideas left off." : "Your own space for everything you make."}</p>
              <form className="mt-8 space-y-5" onSubmit={submit}>
                {mode === "signup" ? <div className="space-y-2"><Label htmlFor="display-name">Display name</Label><Input id="display-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></div> : null}
                <div className="space-y-2"><Label htmlFor="email">Email</Label><div className="relative"><MailIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="email" type="email" autoComplete="email" className="pl-9" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></div>
                <div className="space-y-2"><Label htmlFor="password">Password</Label><div className="relative"><LockKeyholeIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} className="pl-9" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></div></div>
                <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}<ArrowRightIcon /></Button>
              </form>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />OR CONTINUE WITH<span className="h-px flex-1 bg-border" /></div>
              <div className="grid gap-3">
                <Button type="button" variant="outline" className="h-11 w-full border-input bg-background text-foreground hover:bg-accent" disabled={busy} onClick={() => void oauth("google")}><GoogleMark />Continue with Google</Button>
              </div>
              <p className="mt-7 text-center text-sm text-muted-foreground">{mode === "signin" ? "New to Mortagi?" : "Already have an account?"}{" "}<button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create an account" : "Sign in"}</button></p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>;
}