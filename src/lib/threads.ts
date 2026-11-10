import type { UIMessage } from "ai";

/**
 * Thread store backed by localStorage. All functions guard `typeof window`
 * so they are safe to import from SSR-rendered modules, but they only
 * perform real work in the browser.
 */

export interface StoredThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

const THREADS_KEY = "mortagi:threads";
const LEGACY_THREADS_KEY = "milky:threads";
const messagesKey = (threadId: string) => `mortagi:thread:${threadId}:messages`;
const legacyMessagesKey = (threadId: string) => `milky:thread:${threadId}:messages`;

export const THREAD_ID_RE = /^[0-9a-zA-Z-]{8,64}$/;

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeThreads(threads: StoredThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
}

/** Threads sorted by most recently updated. */
export function loadThreads(): StoredThread[] {
  const threads = readJson<StoredThread[]>(THREADS_KEY) ?? readJson<StoredThread[]>(LEGACY_THREADS_KEY) ?? [];
  return threads
    .filter((t) => t && typeof t.id === "string" && typeof t.updatedAt === "number")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadThreadMessages(threadId: string): UIMessage[] {
  const raw = readJson<UIMessage[]>(messagesKey(threadId)) ?? readJson<UIMessage[]>(legacyMessagesKey(threadId)) ?? [];
  return raw
    .filter((m) => m && typeof m.id === "string" && Array.isArray(m.parts))
    .map((m) => ({ ...m, id: m.id }));
}

export function createThread(title = "New chat"): StoredThread {
  const thread: StoredThread = {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  writeThreads([thread, ...loadThreads()]);
  return thread;
}

/** Creates the thread record only if it does not exist yet (idempotent). */
export function ensureThread(threadId: string): StoredThread {
  const existing = loadThreads().find((t) => t.id === threadId);
  if (existing) return existing;
  const thread: StoredThread = {
    id: threadId,
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  writeThreads([thread, ...loadThreads()]);
  return thread;
}

export function saveThreadMessages(threadId: string, messages: UIMessage[]): StoredThread | null {
  if (typeof window === "undefined" || !THREAD_ID_RE.test(threadId)) return null;
  const stored = ensureThread(threadId);
  window.localStorage.setItem(messagesKey(threadId), JSON.stringify(messages));

  const firstUserText = messages
    .filter((m) => m.role === "user")
    .flatMap((m) => m.parts.filter((p) => p.type === "text").map((p) => p.text))
    .find((text) => text.trim().length > 0);

  const updated: StoredThread = {
    ...stored,
    title: firstUserText ? firstUserText.trim().slice(0, 60) : stored.title,
    updatedAt: Date.now(),
  };
  writeThreads([updated, ...loadThreads().filter((t) => t.id !== threadId)]);
  return updated;
}

export function deleteThread(threadId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(messagesKey(threadId));
  writeThreads(loadThreads().filter((t) => t.id !== threadId));
}

export function threadGroupLabel(timestamp: number): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfToday - dayMs) return "Yesterday";
  if (timestamp >= startOfToday - 7 * dayMs) return "Previous 7 days";
  if (timestamp >= startOfToday - 30 * dayMs) return "Previous 30 days";
  return "Older";
}
