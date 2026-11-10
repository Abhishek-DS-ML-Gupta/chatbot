import type { UIMessage } from "ai";
import { beforeEach, describe, expect, it } from "vitest";

import {
  createThread,
  deleteThread,
  ensureThread,
  loadThreadMessages,
  loadThreads,
  saveThreadMessages,
} from "@/lib/threads";

const userMessage = (text: string): UIMessage => ({
  id: `u-${text}`,
  role: "user",
  parts: [{ type: "text", text }],
});

beforeEach(() => {
  localStorage.clear();
});

describe("threads localStorage store", () => {
  it("creates a thread and lists it first, newest updated first", () => {
    const first = createThread();
    const second = createThread();

    const threads = loadThreads();
    expect(threads.map((t) => t.id)).toEqual([second.id, first.id]);
  });

  it("persists messages under the thread and restores them", () => {
    const thread = createThread();
    saveThreadMessages(thread.id, [userMessage("hello there")]);

    expect(loadThreadMessages(thread.id)).toEqual([userMessage("hello there")]);
  });

  it("uses the first user message as the thread title", () => {
    const thread = createThread();
    saveThreadMessages(thread.id, [userMessage("What is the capital of France?")]);

    const updated = loadThreads().find((t) => t.id === thread.id);
    expect(updated?.title).toBe("What is the capital of France?");
  });

  it("ensureThread is idempotent — it never duplicates a thread", () => {
    const thread = createThread();
    ensureThread(thread.id);
    ensureThread(thread.id);

    expect(loadThreads()).toHaveLength(1);
  });

  it("deleteThread removes the listing and the stored messages", () => {
    const thread = createThread();
    saveThreadMessages(thread.id, [userMessage("to be deleted")]);

    deleteThread(thread.id);

    expect(loadThreads()).toHaveLength(0);
    expect(loadThreadMessages(thread.id)).toEqual([]);
  });
});
