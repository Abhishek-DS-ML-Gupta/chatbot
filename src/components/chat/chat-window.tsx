import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageActions,
  MessageAction,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { saveThreadMessages } from "@/lib/threads";
import { CopyIcon } from "lucide-react";
import type { UIMessage } from "ai";

interface ChatWindowProps {
  threadId: string;
  initialMessages: UIMessage[];
  onThreadsChanged: () => void;
}

const SUGGESTIONS = [
  "Explain quantum computing in simple terms",
  "Write a short poem about coffee",
  "Plan a 3-day trip to Kyoto",
  "Give me ideas for a side project",
];

export function ChatWindow({ threadId, initialMessages, onThreadsChanged }: ChatWindowProps) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
  });

  useEffect(() => {
    if (error) toast.error(error.message || "Something went wrong. Please try again.");
  }, [error]);

  // Persist after each completed turn, and immediately for a freshly sent user message.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    if (status === "ready" || (last.role === "user" && status !== "streaming")) {
      saveThreadMessages(threadId, messages);
      onThreadsChanged();
    }
  }, [messages, status, threadId, onThreadsChanged]);

  // Keep the composer focused for typing after each turn completes.
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text?.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    sendMessage({ text });
  };

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const lastAssistantEmpty =
    busy &&
    lastMessage?.role === "assistant" &&
    !lastMessage.parts.some((p) => p.type === "text" && p.text);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:py-8">
          {messages.length === 0 ? (
            <EmptyState onPick={(text) => sendMessage({ text })} />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent
                  className={
                    message.role === "user"
                      ? "rounded-3xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed"
                      : "text-[15px] leading-relaxed"
                  }
                >
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      if (message.role === "user") {
                        return (
                          <span key={index} className="whitespace-pre-wrap">
                            {part.text}
                          </span>
                        );
                      }
                      return <MessageResponse key={index}>{part.text}</MessageResponse>;
                    }
                    return null;
                  })}
                </MessageContent>
                {message.role === "assistant" && status === "ready" ? (
                  <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
                    <MessageAction
                      tooltip="Copy"
                      label="Copy message"
                      onClick={() => {
                        const text = message.parts
                          .filter((p) => p.type === "text")
                          .map((p) => p.text)
                          .join("");
                        navigator.clipboard.writeText(text).catch(() => {});
                      }}
                    >
                      <CopyIcon />
                    </MessageAction>
                  </MessageActions>
                ) : null}
              </Message>
            ))
          )}
          {status === "submitted" || lastAssistantEmpty ? (
            <div className="text-[15px]">
              <Shimmer className="text-muted-foreground">Thinking…</Shimmer>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton className="bg-card" />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:pb-6">
        <PromptInput
          onSubmit={handleSubmit}
          className="rounded-3xl border-border bg-card shadow-composer"
        >
          <PromptInputTextarea
            ref={textareaRef}
            autoFocus
            placeholder="Message Mortagi…"
            className="min-h-[56px] text-[15px]"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Mortagi can make mistakes. Check important information.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="grid size-20 place-items-center rounded-2xl bg-primary text-3xl font-semibold text-primary-foreground shadow-composer">
        M
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          What's on your mind?
        </h1>
        <p className="text-sm text-muted-foreground">Ask anything — Mortagi replies in a friendly, human way.</p>
      </div>
      <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-xs transition-colors hover:bg-accent"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
