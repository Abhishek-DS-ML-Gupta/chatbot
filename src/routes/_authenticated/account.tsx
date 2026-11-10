import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, LogOutIcon, SaveIcon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { loadProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
  head: () => ({ meta: [
    { title: "Account settings · Mortagi" },
    { name: "description", content: "Manage your Mortagi display name and account." },
    { property: "og:title", content: "Account settings · Mortagi" },
    { property: "og:description", content: "Update your personal Mortagi account details." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function AccountPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

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
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim(), updated_at: new Date().toISOString() }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Your profile has been saved.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return <main className="min-h-dvh bg-background"><header className="flex h-16 items-center border-b border-border px-5 md:px-9"><Button variant="ghost" size="icon-sm" aria-label="Back to dashboard" onClick={() => void navigate({ to: "/dashboard" })}><ArrowLeftIcon /></Button><span className="ml-3 font-semibold">Account settings</span></header><div className="mx-auto max-w-2xl px-5 py-12 md:px-9"><p className="text-sm font-medium text-muted-foreground">YOUR PROFILE</p><h1 className="mt-2 font-display text-3xl font-semibold">Account details</h1><p className="mt-2 text-muted-foreground">A few details for your personal workspace.</p><section className="mt-9 border-y border-border py-7"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><UserRoundIcon /></span><div><p className="font-medium">{user?.email}</p><p className="text-sm text-muted-foreground">Email address</p></div></div><div className="mt-7 max-w-md space-y-2"><Label htmlFor="account-name">Display name</Label><Input id="account-name" value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} /></div><Button className="mt-5" onClick={() => void saveProfile()} disabled={busy}><SaveIcon />Save profile</Button></section><section className="mt-8"><h2 className="font-semibold">Sign out</h2><p className="mt-1 text-sm text-muted-foreground">End this session on this device.</p><Button variant="outline" className="mt-4" onClick={() => void signOut()}><LogOutIcon />Sign out</Button></section></div></main>;
}