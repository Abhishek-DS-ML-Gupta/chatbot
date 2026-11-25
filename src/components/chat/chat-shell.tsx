import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PanelLeftIcon, SparklesIcon, UserRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreadSidebar } from "@/components/chat/thread-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
import { useAuth } from "@/lib/auth-context";
import { createThread, deleteThread, type StoredThread } from "@/lib/threads";

interface ChatShellProps {
  threadId: string;
  threads: StoredThread[];
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  onThreadsChanged: () => void;
  initialMessages: import("ai").UIMessage[];
  onNavigate: (threadId: string) => void;
}

export function ChatShell({
  threadId,
  threads,
  sidebarOpen,
  onSidebarOpenChange,
  onThreadsChanged,
  initialMessages,
  onNavigate,
}: ChatShellProps) {
  const activeThread = threads.find((t) => t.id === threadId);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleNew = useCallback(() => {
    const thread = createThread();
    onNavigate(thread.id);
  }, [onNavigate]);

  const handleDelete = useCallback(
    (deletedId: string) => {
      deleteThread(deletedId);
      onThreadsChanged();
      if (deletedId === threadId) {
        const next = threads.filter((t) => t.id !== deletedId)[0];
        if (next) onNavigate(next.id);
        else handleNew();
      }
    },
    [threadId, threads, onThreadsChanged, onNavigate, handleNew],
  );

  const avatarUrl =
    (user?.user_metadata?.["avatar_url"] as string | undefined) ||
    (user?.user_metadata?.["picture"] as string | undefined);
  const displayName =
    (user?.user_metadata?.["full_name"] as string | undefined) ||
    (user?.user_metadata?.["name"] as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Account";

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <ThreadSidebar
        threads={threads}
        activeId={threadId}
        open={sidebarOpen}
        onClose={() => onSidebarOpenChange(false)}
        onSelect={onNavigate}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => onSidebarOpenChange(true)}
              aria-label="Open sidebar"
            >
              <PanelLeftIcon className="size-4" />
            </Button>
            <h2 className="truncate text-sm font-medium text-foreground">
              {activeThread?.title ?? "New chat"}
            </h2>
            <span className="hidden items-center gap-1 rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex">
              <SparklesIcon className="size-3" />
              Mortagi
            </span>
          </div>

          {user ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 gap-2 rounded-full pl-1.5 pr-3 hover:bg-accent"
              onClick={() => void navigate({ to: "/account" })}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="size-6 rounded-full border border-border object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="grid size-6 place-items-center rounded-full bg-secondary text-secondary-foreground">
                  <UserRoundIcon className="size-3.5" />
                </span>
              )}
              <span className="hidden text-xs font-medium sm:inline">{displayName}</span>
            </Button>
          ) : null}
        </header>

        <ChatWindow
          key={threadId}
          threadId={threadId}
          initialMessages={initialMessages}
          onThreadsChanged={onThreadsChanged}
        />
      </div>
    </div>
  );
}
