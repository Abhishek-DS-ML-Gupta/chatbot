import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
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
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { saveThreadMessages } from "@/lib/threads";
import { CopyIcon, DownloadIcon, ImageIcon, MessageSquareIcon } from "lucide-react";

interface ChatWindowProps {
  threadId: string;
  initialMessages: UIMessage[];
  onThreadsChanged: () => void;
}

type ComposerMode = "chat" | "image";

const SUGGESTIONS = [
  "Explain quantum computing in simple terms",
  "Write a short poem about coffee",
  "Plan a 3-day trip to Kyoto",
  "Give me ideas for a side project",
];

const IMAGE_MODELS = [
  { id: "huggingface/dreamshaper-8", label: "Dreamshaper 8" },
  { id: "@cf/black-forest-labs/flux-1-schnell", label: "Flux Schnell" },
  { id: "klingai/kling-v3-image", label: "Kling v3" },
] as const;

const ASPECT_RATIOS = ["16:9", "1:1", "9:16"] as const;

export function ChatWindow({ threadId, initialMessages, onThreadsChanged }: ChatWindowProps) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<ComposerMode>("chat");
  const [imageModel, setImageModel] = useState<string>("huggingface/dreamshaper-8");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
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
    if (status === "ready" && !isGeneratingImage) textareaRef.current?.focus();
  }, [status, isGeneratingImage]);

  const generateImageInChat = async (prompt: string) => {
    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: prompt }],
    };

    const withUser = [...messages, userMessage];
    setMessages(withUser);
    saveThreadMessages(threadId, withUser);
    onThreadsChanged();
    setIsGeneratingImage(true);

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: imageModel,
          aspect_ratio: aspectRatio,
          resolution: "1k",
        }),
      });

      const data = (await response.json()) as { error?: string; image?: string; success?: boolean };
      if (!response.ok || data.error || !data.image) {
        throw new Error(data.error || "Failed to generate image.");
      }

      const mimeMatch = data.image.match(/^data:([^;]+);/);
      const mediaType = mimeMatch?.[1] || "image/webp";

      const assistantMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [
          {
            type: "file",
            url: data.image,
            mediaType,
          },
        ],
      };

      setMessages((prev) => {
        const next = [...prev, assistantMessage];
        saveThreadMessages(threadId, next);
        return next;
      });
      onThreadsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text?.trim();
    if (!text || status === "submitted" || status === "streaming" || isGeneratingImage) return;

    if (mode === "image") {
      void generateImageInChat(text);
      return;
    }

    sendMessage({ text });
  };

  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `mortagi-image-${Date.now()}.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const busy = status === "submitted" || status === "streaming" || isGeneratingImage;
  const effectiveStatus = isGeneratingImage ? "submitted" : status;
  const lastMessage = messages.at(-1);
  const lastAssistantEmpty =
    (status === "submitted" || status === "streaming") &&
    lastMessage?.role === "assistant" &&
    !lastMessage.parts.some((p) => p.type === "text" && p.text);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 md:py-8">
          {messages.length === 0 ? (
            <EmptyState
              mode={mode}
              onPick={(text) => {
                if (mode === "image") void generateImageInChat(text);
                else sendMessage({ text });
              }}
            />
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
                    if (part.type === "file" && part.url) {
                      return (
                        <div key={index} className="space-y-2">
                          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
                            <img
                              src={part.url}
                              alt="Generated visual"
                              className="max-h-[480px] w-auto object-contain"
                            />
                          </div>
                          <div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => handleDownloadImage(part.url)}
                            >
                              <DownloadIcon className="size-3.5" />
                              Download
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
                {message.role === "assistant" &&
                !busy &&
                message.parts.some((p) => p.type === "text" && p.text) ? (
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
          {isGeneratingImage ? (
            <div className="text-[15px]">
              <Shimmer className="text-muted-foreground">Generating image…</Shimmer>
            </div>
          ) : status === "submitted" || lastAssistantEmpty ? (
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
            placeholder={
              mode === "image"
                ? "Describe the image you want to create…"
                : "Message Mortagi…"
            }
            className="min-h-[56px] text-[15px]"
          />
          <PromptInputFooter className="justify-between">
            <PromptInputTools className="flex-wrap gap-1">
              <PromptInputSelect
                value={mode}
                onValueChange={(value) => setMode(value as ComposerMode)}
              >
                <PromptInputSelectTrigger
                  aria-label="Switch mode"
                  className="h-8 gap-1.5 rounded-full px-2.5 text-xs"
                >
                  {mode === "image" ? (
                    <ImageIcon className="size-3.5" />
                  ) : (
                    <MessageSquareIcon className="size-3.5" />
                  )}
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent align="start">
                  <PromptInputSelectItem value="chat">
                    <span className="flex items-center gap-2">
                      <MessageSquareIcon className="size-3.5" />
                      Chat
                    </span>
                  </PromptInputSelectItem>
                  <PromptInputSelectItem value="image">
                    <span className="flex items-center gap-2">
                      <ImageIcon className="size-3.5" />
                      Image
                    </span>
                  </PromptInputSelectItem>
                </PromptInputSelectContent>
              </PromptInputSelect>

              {mode === "image" ? (
                <>
                  <PromptInputSelect value={imageModel} onValueChange={setImageModel}>
                    <PromptInputSelectTrigger
                      aria-label="Image model"
                      className="h-8 rounded-full px-2.5 text-xs"
                    >
                      <PromptInputSelectValue />
                    </PromptInputSelectTrigger>
                    <PromptInputSelectContent align="start">
                      {IMAGE_MODELS.map((m) => (
                        <PromptInputSelectItem key={m.id} value={m.id}>
                          {m.label}
                        </PromptInputSelectItem>
                      ))}
                    </PromptInputSelectContent>
                  </PromptInputSelect>

                  {(imageModel.includes("huggingface") || imageModel.includes("kling")) && (
                    <PromptInputSelect value={aspectRatio} onValueChange={setAspectRatio}>
                      <PromptInputSelectTrigger
                        aria-label="Aspect ratio"
                        className="h-8 rounded-full px-2.5 text-xs"
                      >
                        <PromptInputSelectValue />
                      </PromptInputSelectTrigger>
                      <PromptInputSelectContent align="start">
                        {ASPECT_RATIOS.map((ratio) => (
                          <PromptInputSelectItem key={ratio} value={ratio}>
                            {ratio}
                          </PromptInputSelectItem>
                        ))}
                      </PromptInputSelectContent>
                    </PromptInputSelect>
                  )}
                </>
              ) : null}
            </PromptInputTools>

            <PromptInputSubmit
              status={effectiveStatus}
              onStop={() => {
                if (!isGeneratingImage) void stop();
              }}
            />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Mortagi can make mistakes. Check important information.
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  mode,
  onPick,
}: {
  mode: ComposerMode;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="grid size-20 place-items-center rounded-2xl bg-primary text-3xl font-semibold text-primary-foreground shadow-composer">
        M
      </div>
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {mode === "image" ? "What would you like to create?" : "What's on your mind?"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "image"
            ? "Describe any scene — Mortagi will generate an image right here in chat."
            : "Ask anything — or switch to Image mode below to create visuals."}
        </p>
      </div>
      {mode === "chat" ? (
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
      ) : null}
    </div>
  );
}
