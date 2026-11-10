import { createFileRoute, useNavigate, useHydrated } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChatShell } from "@/components/chat/chat-shell";
import { createThread, loadThreadMessages, loadThreads, type StoredThread } from "@/lib/threads";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatThreadPage,
  head: () => ({
    meta: [
      { title: "Mortagi — Your AI companion" },
      {
        name: "description",
        content: "Chat with Mortagi, a warm AI companion. Your conversations stay private in this browser.",
      },
      { property: "og:title", content: "Mortagi — Your AI companion" },
      {
        property: "og:description",
        content: "Chat with Mortagi, a warm AI companion. Your conversations stay private in this browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const [threads, setThreads] = useState<StoredThread[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const recoveringRef = useRef(false);

  // Recover from a direct visit to an unknown thread id.
  useEffect(() => {
    if (!hydrated || recoveringRef.current) return;
    if (loadThreads().some((t) => t.id === threadId)) return;
    recoveringRef.current = true;
    const fallback = loadThreads()[0] ?? createThread();
    navigate({ to: "/chat/$threadId", params: { threadId: fallback.id }, replace: true });
  }, [hydrated, threadId, navigate]);

  useEffect(() => {
    if (!hydrated) return;
    setThreads(loadThreads());
  }, [hydrated, threadId]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-16 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  const activeThread = threads.find((t) => t.id === threadId);
  if (!activeThread) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-16 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  const refreshThreads = () => setThreads(loadThreads());

  return (
    <ChatShell
      threadId={threadId}
      threads={threads}
      sidebarOpen={sidebarOpen}
      onSidebarOpenChange={setSidebarOpen}
      onThreadsChanged={refreshThreads}
      initialMessages={loadThreadMessages(threadId)}
      onNavigate={(nextId) => {
        setSidebarOpen(false);
        navigate({ to: "/chat/$threadId", params: { threadId: nextId } });
      }}
    />
  );
}
