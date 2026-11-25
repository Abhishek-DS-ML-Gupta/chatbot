import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChatShell } from "@/components/chat/chat-shell";
import { createThread, loadThreadMessages, loadThreads, type StoredThread } from "@/lib/threads";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Mortagi — Your AI companion" },
      { name: "description", content: "Chat and generate images with Mortagi in one unified workspace." },
      { property: "og:title", content: "Mortagi — Your AI companion" },
      { property: "og:description", content: "Chat and generate images with Mortagi in one unified workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DashboardPage() {
  const hydrated = useHydrated();
  const [threads, setThreads] = useState<StoredThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const existing = loadThreads();
    if (existing.length > 0 && existing[0]) {
      setThreads(existing);
      setActiveThreadId((prev) => (prev && existing.some((t) => t.id === prev) ? prev : existing[0]!.id));
    } else {
      const fresh = createThread();
      setThreads(loadThreads());
      setActiveThreadId(fresh.id);
    }
  }, [hydrated]);

  if (!hydrated || !activeThreadId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-16 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  const refreshThreads = () => setThreads(loadThreads());

  return (
    <ChatShell
      threadId={activeThreadId}
      threads={threads}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      onThreadsChanged={refreshThreads}
      initialMessages={loadThreadMessages(activeThreadId)}
      onNavigate={(nextId) => {
        setSidebarOpen(false);
        setActiveThreadId(nextId);
        refreshThreads();
      }}
    />
  );
}
