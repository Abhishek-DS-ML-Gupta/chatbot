import { useCallback } from "react";
import { PanelLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreadSidebar } from "@/components/chat/thread-sidebar";
import { ChatWindow } from "@/components/chat/chat-window";
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
        <header className="flex items-center gap-2 px-4 py-3 md:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => onSidebarOpenChange(true)}
            aria-label="Open sidebar"
          >
            <PanelLeftIcon />
          </Button>
          <h2 className="truncate text-sm font-medium text-foreground">
            {activeThread?.title ?? "New chat"}
          </h2>
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
