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
import {
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  CpuIcon,
  DownloadIcon,
  ImageIcon,
  MessageSquareTextIcon,
  RatioIcon,
  SquareIcon,
  WandSparklesIcon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface ChatWindowProps {
  threadId: string;
  initialMessages: UIMessage[];
  onThreadsChanged: () => void;
}

type ComposerMode = "chat" | "image";

const CHAT_SUGGESTIONS = [
  "Explain quantum computing simply",
  "Write a short poem about coffee",
  "Plan a 3-day trip to Kyoto",
  "Ideas for a weekend AI project",
];

const IMAGE_SUGGESTIONS = [
  "Photorealistic fox in an autumn forest, golden hour",
  "Minimalist glass cabin in snowy Norwegian fjords",
  "Futuristic Tokyo street market with neon rain reflections",
];

const IMAGE_MODELS = [
  { id: "huggingface/dreamshaper-8", label: "Dreamshaper 8" },
  { id: "@cf/black-forest-labs/flux-1-schnell", label: "Flux Schnell" },
  { id: "klingai/kling-v3-image", label: "Kling v3" },
] as const;

const ASPECT_RATIOS = ["16:9", "1:1", "9:16"] as const;

function aspectClassFor(ratio: string): string {
  if (ratio === "1:1") return "aspect-square max-w-sm";
  if (ratio === "9:16") return "aspect-[9/16] max-w-[260px]";
  return "aspect-video max-w-md";
}

function MortagiAvatar({ pulsing = false }: { pulsing?: boolean }) {
  return (
    <span
      className={`grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground shadow-2xs ${
        pulsing ? "animate-pulse ring-2 ring-primary/20" : ""
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3l2.1 5.4L19.5 10l-5.4 2.1L12 17.5l-2.1-5.4L4.5 10l5.4-1.6L12 3z" />
      </svg>
    </span>
  );
}

export function ChatWindow({ threadId, initialMessages, onThreadsChanged }: ChatWindowProps) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<ComposerMode>("chat");
  const [imageModel, setImageModel] = useState<string>("huggingface/dreamshaper-8");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const handleCopyMessage = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(messageId);
    setTimeout(() => setCopiedId((prev) => (prev === messageId ? null : prev)), 1800);
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
            messages.map((message, messageIndex) => {
              const isStreamingThis =
                status === "streaming" &&
                message.role === "assistant" &&
                messageIndex === messages.length - 1;
              const isAssistant = message.role === "assistant";
              const textContent = message.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("");

              return (
                <Message
                  key={message.id}
                  from={message.role}
                  className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  <div className={isAssistant ? "flex items-start gap-3.5" : "contents"}>
                    {isAssistant ? <MortagiAvatar pulsing={isStreamingThis} /> : null}
                    <div className={isAssistant ? "min-w-0 flex-1 space-y-2" : "contents"}>
                      <MessageContent
                        className={
                          message.role === "user"
                            ? "rounded-3xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed shadow-2xs"
                            : "w-full text-[15px] leading-relaxed"
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
                            return (
                              <div key={index} className="relative">
                                <MessageResponse>{part.text}</MessageResponse>
                                {isStreamingThis ? (
                                  <span
                                    aria-hidden="true"
                                    className="ml-1 inline-block size-2.5 translate-y-0.5 animate-pulse rounded-full bg-foreground/80"
                                  />
                                ) : null}
                              </div>
                            );
                          }
                          if (part.type === "file" && part.url) {
                            return (
                              <div
                                key={index}
                                className="animate-in fade-in zoom-in-[0.98] duration-500 space-y-2.5"
                              >
                                <div className="group/img relative w-fit overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                                  <img
                                    src={part.url}
                                    alt="Generated visual"
                                    className="max-h-[480px] w-auto object-contain"
                                  />
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="absolute right-3 top-3 gap-1.5 rounded-full bg-background/85 opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-background group-hover/img:opacity-100"
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

                      {isAssistant && !busy && textContent ? (
                        <MessageActions className="opacity-0 transition-opacity group-hover:opacity-100">
                          <MessageAction
                            tooltip={copiedId === message.id ? "Copied" : "Copy"}
                            label="Copy message"
                            onClick={() => handleCopyMessage(message.id, textContent)}
                          >
                            {copiedId === message.id ? (
                              <CheckIcon className="size-3.5 text-emerald-600" />
                            ) : (
                              <CopyIcon className="size-3.5" />
                            )}
                          </MessageAction>
                        </MessageActions>
                      ) : null}
                    </div>
                  </div>
                </Message>
              );
            })
          )}

          {isGeneratingImage ? (
            <div className="flex items-start gap-3.5 animate-in fade-in duration-300">
              <MortagiAvatar pulsing />
              <div className="w-full space-y-2.5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <WandSparklesIcon className="size-3.5 animate-pulse" />
                  <Shimmer className="text-sm font-medium">Creating image…</Shimmer>
                </div>
                <div
                  className={`image-skeleton-sweep relative w-full overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-muted via-muted/70 to-accent/50 shadow-xs ${aspectClassFor(
                    aspectRatio,
                  )}`}
                >
                  <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <div className="grid size-11 animate-pulse place-items-center rounded-2xl border border-border/60 bg-background/60 backdrop-blur-sm">
                      <ImageIcon className="size-5 text-muted-foreground/80" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground/80">
                      Rendering with {IMAGE_MODELS.find((m) => m.id === imageModel)?.label ?? "AI"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : status === "submitted" || lastAssistantEmpty ? (
            <div className="flex items-center gap-3.5 animate-in fade-in duration-200">
              <MortagiAvatar pulsing />
              <div className="flex items-center gap-2 text-[15px]">
                <span className="inline-block size-2.5 animate-pulse rounded-full bg-foreground/75" />
                <Shimmer className="text-sm text-muted-foreground">Thinking…</Shimmer>
              </div>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton className="bg-card shadow-sm" />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:pb-6">
        <PromptInput
          onSubmit={handleSubmit}
          className="[&_[data-slot=input-group]]:rounded-3xl [&_[data-slot=input-group]]:border-border/90 [&_[data-slot=input-group]]:bg-card [&_[data-slot=input-group]]:shadow-composer [&_[data-slot=input-group]]:transition-all [&_[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_[data-slot=input-group]]:focus-within:border-foreground/25 [&_[data-slot=input-group]]:focus-within:shadow-lg"
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
          <PromptInputFooter className="justify-between pt-1">
            <PromptInputTools className="flex-wrap gap-1.5">
              <PromptInputSelect
                value={mode}
                onValueChange={(value) => setMode(value as ComposerMode)}
              >
                <PromptInputSelectTrigger
                  aria-label="Switch mode"
                  className={`h-8 gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${
                    mode === "image"
                      ? "border-primary/25 bg-primary/10 text-foreground hover:bg-primary/15"
                      : "border-border/70 bg-muted/50 text-foreground hover:bg-muted"
                  }`}
                >
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent align="start">
                  <PromptInputSelectItem value="chat">
                    <span className="flex items-center gap-2">
                      <MessageSquareTextIcon className="size-3.5" />
                      Chat
                    </span>
                  </PromptInputSelectItem>
                  <PromptInputSelectItem value="image">
                    <span className="flex items-center gap-2">
                      <WandSparklesIcon className="size-3.5" />
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
                      className="h-8 gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 text-xs"
                    >
                      <CpuIcon className="size-3 text-muted-foreground" />
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
                        className="h-8 gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 text-xs"
                      >
                        <RatioIcon className="size-3 text-muted-foreground" />
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
              className="size-8 rounded-full shadow-xs transition-transform active:scale-95"
              onStop={() => {
                if (!isGeneratingImage) void stop();
              }}
            >
              {effectiveStatus === "submitted" ? (
                <Spinner className="size-4" />
              ) : effectiveStatus === "streaming" ? (
                <SquareIcon className="size-3.5 fill-current" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
            </PromptInputSubmit>
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
  const suggestions = mode === "image" ? IMAGE_SUGGESTIONS : CHAT_SUGGESTIONS;

  return (
    <div className="flex size-full flex-col items-center justify-center gap-6 py-16 text-center animate-in fade-in duration-300">
      <div className="grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-composer">
        {mode === "image" ? (
          <WandSparklesIcon className="size-7" />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l2.1 5.4L19.5 10l-5.4 2.1L12 17.5l-2.1-5.4L4.5 10l5.4-1.6L12 3z" />
          </svg>
        )}
      </div>
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {mode === "image" ? "What would you like to create?" : "How can I help today?"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "image"
            ? "Describe any scene — Mortagi generates visuals right here in chat."
            : "Ask anything, or switch the mode below to create images."}
        </p>
      </div>
      <div className="flex max-w-lg flex-wrap items-center justify-center gap-2">
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground shadow-2xs transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-accent"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
