import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { threadGroupLabel, type StoredThread } from "@/lib/threads";
import { Button } from "@/components/ui/button";

const GROUP_ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

interface ThreadSidebarProps {
  threads: StoredThread[];
  activeId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (threadId: string) => void;
  onNew: () => void;
  onDelete: (threadId: string) => void;
}

export function ThreadSidebar({
  threads,
  activeId,
  open,
  onClose,
  onSelect,
  onNew,
  onDelete,
}: ThreadSidebarProps) {
  const groups = new Map<string, StoredThread[]>();
  for (const thread of threads) {
    const label = threadGroupLabel(thread.updatedAt);
    const list = groups.get(label) ?? [];
    list.push(thread);
    groups.set(label, list);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
              M
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground">
              Mortagi
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <XIcon />
          </Button>
        </div>

        <div className="px-3 pt-4">
          <Button
            onClick={onNew}
            variant="outline"
            className="w-full justify-start gap-2 rounded-full border-sidebar-border bg-card text-sm shadow-xs hover:bg-accent"
          >
            <PlusIcon className="size-4" />
            New chat
          </Button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Chat history">
          {threads.length === 0 ? (
            <p className="px-2 py-6 text-sm text-muted-foreground">No chats yet.</p>
          ) : (
            GROUP_ORDER.filter((label) => groups.has(label)).map((label) => (
              <div key={label} className="mb-3">
                <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">{label}</p>
                <ul className="space-y-0.5">
                  {groups.get(label)!.map((thread) => (
                    <li key={thread.id} className="group/row flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(thread.id)}
                        className={`flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                          thread.id === activeId
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        }`}
                      >
                        {thread.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(thread.id)}
                        aria-label={`Delete ${thread.title}`}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100"
                      >
                        <Trash2Icon className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Chats are saved in this browser only.</p>
        </div>
      </aside>
    </>
  );
}
