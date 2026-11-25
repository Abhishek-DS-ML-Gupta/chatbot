import { useNavigate } from "@tanstack/react-router";
import {
  ChevronsUpDownIcon,
  MessageSquareIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { threadGroupLabel, type StoredThread } from "@/lib/threads";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import mortagiIcon from "@/assets/mortagi.svg";

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
  const { user } = useAuth();
  const navigate = useNavigate();

  const groups = new Map<string, StoredThread[]>();
  for (const thread of threads) {
    const label = threadGroupLabel(thread.updatedAt);
    const list = groups.get(label) ?? [];
    list.push(thread);
    groups.set(label, list);
  }

  const displayName =
    (user?.user_metadata?.["full_name"] as string | undefined) ||
    (user?.user_metadata?.["name"] as string | undefined) ||
    (user?.user_metadata?.["display_name"] as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Account";
  const avatarUrl =
    (user?.user_metadata?.["avatar_url"] as string | undefined) ||
    (user?.user_metadata?.["picture"] as string | undefined);
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "M";

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl border border-sidebar-border bg-card p-0.5 shadow-xs">
              <img src={mortagiIcon} alt="Mortagi" className="size-full object-contain" />
            </span>
            <span className="font-display text-base font-semibold tracking-tight text-sidebar-foreground">
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
            <XIcon className="size-4" />
          </Button>
        </div>

        <div className="px-3 pt-1">
          <Button
            onClick={onNew}
            variant="outline"
            className="h-10 w-full justify-between rounded-xl border-sidebar-border bg-card px-3 text-sm font-medium shadow-xs transition-all hover:bg-accent"
          >
            <span className="flex items-center gap-2">
              <SquarePenIcon className="size-4 text-muted-foreground" />
              New chat
            </span>
          </Button>
        </div>

        <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Chat history">
          {threads.length === 0 ? (
            <p className="px-2 py-6 text-sm text-muted-foreground">No chats yet.</p>
          ) : (
            GROUP_ORDER.filter((label) => groups.has(label)).map((label) => (
              <div key={label} className="mb-3">
                <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {label}
                </p>
                <ul className="space-y-0.5">
                  {groups.get(label)!.map((thread) => {
                    const isActive = thread.id === activeId;
                    return (
                      <li key={thread.id} className="group/row relative flex items-center">
                        <button
                          type="button"
                          onClick={() => onSelect(thread.id)}
                          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 pr-8 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-2xs"
                              : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                          }`}
                        >
                          <MessageSquareIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{thread.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(thread.id)}
                          aria-label={`Delete ${thread.title}`}
                          className="absolute right-1.5 rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover/row:opacity-100"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {user ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                void navigate({ to: "/account" });
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border/80 bg-card/80 p-2.5 text-left shadow-2xs transition-all hover:border-border hover:bg-card"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="size-9 shrink-0 rounded-full border border-border object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <p className="px-1 py-1 text-xs text-muted-foreground">
              Chats are saved in this browser only.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
