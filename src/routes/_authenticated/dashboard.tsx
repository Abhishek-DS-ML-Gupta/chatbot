import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRightIcon, MessageSquareIcon, PlusIcon, UserRoundIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { createConversation, getConversations, type CloudConversation } from "@/lib/cloud-chat";
import { loadProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [
    { title: "Your Mortagi workspace" },
    { name: "description", content: "Your private Mortagi dashboard for conversations, images, and files." },
    { property: "og:title", content: "Your Mortagi workspace" },
    { property: "og:description", content: "Pick up a conversation or start something new in your personal workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<CloudConversation[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void Promise.all([getConversations(), loadProfile(user.id, user.email)]).then(([items, profile]) => {
      setConversations(items);
      setDisplayName(profile.display_name || user.email?.split("@")[0] || "there");
    }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Couldn't load your workspace."));
  }, [user]);

  async function startChat() {
    setSaving(true);
    try {
      const conversation = await createConversation();
      await navigate({ to: "/chat/$threadId", params: { threadId: conversation.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start a conversation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-5 md:px-9">
        <div className="flex items-center gap-3 text-lg font-semibold"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">M</span>Mortagi</div>
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/account" })}><UserRoundIcon />Account</Button>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-12 md:px-9 md:py-16">
        <p className="text-sm font-medium text-muted-foreground">YOUR WORKSPACE</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div><h1 className="font-display text-4xl font-semibold">Good to see you, {displayName || "there"}.</h1><p className="mt-2 text-muted-foreground">What would you like to work on today?</p></div>
          <Button className="h-11" onClick={() => void startChat()} disabled={saving}><PlusIcon />New chat</Button>
        </div>
        <div className="mt-11 grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => void startChat()} className="group flex min-h-44 flex-col justify-between border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent">
            <span className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground"><MessageSquareIcon className="size-5" /></span>
            <span className="flex items-center justify-between gap-2"><span><span className="block font-medium">Start a conversation</span><span className="mt-1 block text-sm text-muted-foreground">Think through an idea with Mortagi.</span></span><ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
          </button>
          <button type="button" onClick={() => void navigate({ to: "/images" })} className="group flex min-h-44 flex-col justify-between border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent">
            <span className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground"><WandSparklesIcon className="size-5" /></span>
            <span className="flex items-center justify-between gap-2"><span><span className="block font-medium">Create an image</span><span className="mt-1 block text-sm text-muted-foreground">Turn a prompt into a visual.</span></span><ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
          </button>
        </div>
        <section className="mt-14">
          <div className="flex items-center justify-between border-b border-border pb-4"><h2 className="font-display text-xl font-semibold">Recent conversations</h2><Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/account" })}>Account settings</Button></div>
          {conversations.length ? <ul className="divide-y divide-border">{conversations.map((conversation) => <li key={conversation.id}><button type="button" className="flex w-full items-center justify-between gap-4 py-4 text-left hover:text-primary" onClick={() => void navigate({ to: "/chat/$threadId", params: { threadId: conversation.id } })}><span className="truncate">{conversation.title}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(conversation.updated_at).toLocaleDateString()}</span></button></li>)}</ul> : <p className="py-10 text-center text-sm text-muted-foreground">No conversations yet.</p>}
        </section>
      </div>
    </main>
  );
}