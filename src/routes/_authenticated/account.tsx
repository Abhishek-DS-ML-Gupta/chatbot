import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  LogOutIcon,
  MailIcon,
  SaveIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { loadProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "Account settings · Mortagi" },
      { name: "description", content: "Manage your Mortagi display name and account." },
      { property: "og:title", content: "Account settings · Mortagi" },
      { property: "og:description", content: "Update your personal Mortagi account details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const avatarUrl =
    (user?.user_metadata?.["avatar_url"] as string | undefined) ||
    (user?.user_metadata?.["picture"] as string | undefined);
  const provider = (user?.app_metadata?.["provider"] as string | undefined) || "email";

  useEffect(() => {
    if (!user) return;
    const initialName =
      (user.user_metadata?.["full_name"] as string | undefined) ||
      (user.user_metadata?.["name"] as string | undefined) ||
      user.email?.split("@")[0] ||
      "";
    setDisplayName(initialName);
    void loadProfile(user.id, user.email)
      .then((profile) => {
        if (profile?.display_name) setDisplayName(profile.display_name);
      })
      .catch((error: unknown) => {
        console.warn("Profile load warning:", error);
      });
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Your profile has been saved.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "M";

  return (
    <main className="min-h-dvh bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-5 backdrop-blur-md md:px-9">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to workspace"
            onClick={() => void navigate({ to: "/dashboard" })}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold">Account settings</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-10 md:px-9">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="h-24 bg-gradient-to-r from-primary/15 via-accent to-secondary" />
          <div className="px-6 pb-6">
            <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || "User avatar"}
                    className="size-20 rounded-2xl border-4 border-card bg-card object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="grid size-20 place-items-center rounded-2xl border-4 border-card bg-primary text-2xl font-semibold text-primary-foreground shadow-sm">
                    {initials}
                  </span>
                )}
                <div className="pb-1">
                  <h1 className="font-display text-2xl font-semibold text-foreground">
                    {displayName || "Mortagi User"}
                  </h1>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MailIcon className="size-3.5" />
                    {user?.email}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground">
                <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                Signed in with {provider === "google" ? "Google" : "Email"}
              </span>
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <div className="max-w-md space-y-2">
                <Label htmlFor="account-name" className="flex items-center gap-1.5">
                  <UserRoundIcon className="size-3.5 text-muted-foreground" />
                  Display name
                </Label>
                <Input
                  id="account-name"
                  value={displayName}
                  maxLength={80}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <Button className="mt-4 gap-2" onClick={() => void saveProfile()} disabled={busy}>
                <SaveIcon className="size-4" />
                {busy ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </div>
        </div>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <ShieldCheckIcon className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">Session &amp; Sign out</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                End your Mortagi session on this device.
              </p>
            </div>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void signOut()}>
            <LogOutIcon className="size-4" />
            Sign out
          </Button>
        </section>
      </div>
    </main>
  );
}
