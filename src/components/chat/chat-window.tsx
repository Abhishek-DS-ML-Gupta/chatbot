import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
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
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { saveThreadMessages } from "@/lib/threads";
import mortagiIcon from "@/assets/mortagi.svg";
import {
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  CpuIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  MessageSquareTextIcon,
  PlusIcon,
  RatioIcon,
  SquareIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";

interface ChatWindowProps {
  threadId: string;
  initialMessages: UIMessage[];
  onThreadsChanged: () => void;
}

type ComposerMode = "chat" | "image";

const CHAT_SUGGESTIONS = [
  "Explain quantum computing simply",
  "Summarize an uploaded document or photo",
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
      className={`grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-card p-0.5 shadow-2xs ${
        pulsing ? "ring-2 ring-primary/25" : ""
      }`}
    >
      <img src={mortagiIcon} alt="Mortagi" className="size-full object-contain" />
    </span>
  );
}

function AttachmentPreviewHeader() {
  const { files, remove } = usePromptInputAttachments();
  if (files.length === 0) return null;

  return (
    <PromptInputHeader className="flex flex-wrap gap-2 pb-1 pt-2.5">
      {files.map((file) => {
        const isImage = file.mediaType?.startsWith("image/") || file.url?.startsWith("data:image/");
        return (
          <div
            key={file.id}
            className="group/att relative flex items-center gap-2 rounded-xl border border-border bg-muted/60 p-1.5 pr-7 text-xs shadow-2xs"
          >
            {isImage && file.url ? (
              <img
                src={file.url}
                alt={file.filename || "Attachment"}
                className="size-10 rounded-lg object-cover"
              />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground">
                <FileTextIcon className="size-4" />
              </span>
            )}
            <span className="max-w-[140px] truncate font-medium text-foreground">
              {file.filename || (isImage ? "Image" : "Document")}
            </span>
            <button
              type="button"
              aria-label={`Remove ${file.filename || "attachment"}`}
              onClick={() => remove(file.id)}
              className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/90 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        );
      })}
    </PromptInputHeader>
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
  const [freshImageMsgId, setFreshImageMsgId] = useState<string | null>(null);

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
      const assistantMsgId = crypto.randomUUID();

      const assistantMessage: UIMessage = {
        id: assistantMsgId,
        role: "assistant",
        parts: [
          {
            type: "file",
            url: data.image,
            mediaType,
          },
        ],
      };

      setFreshImageMsgId(assistantMsgId);
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
    const files: FileUIPart[] = message.files ?? [];
    if ((!text && files.length === 0) || status === "submitted" || status === "streaming" || isGeneratingImage) {
      return;
    }

    if (mode === "image") {
      if (!text) {
        toast.error("Please enter a prompt to generate an image.");
        return;
      }
      void generateImageInChat(text);
      return;
    }

    const promptText = text || "Please analyze the attached file(s).";
    if (files.length > 0) {
      void sendMessage({ text: promptText, files });
    } else {
      void sendMessage({ text: promptText });
    }
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
                else void sendMessage({ text });
              }}
            />
          ) : (
            messages.map((message, messageIndex) => {
              const isStreamingThis =
                status === "streaming" &&
                message.role === "assistant" &&
                messageIndex === messages.length - 1;
              const isAssistant = message.role === "assistant";
              const isFreshImage = message.id === freshImageMsgId;
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
                              <MessageResponse
                                key={index}
                                isAnimating={isStreamingThis}
                                animated
                                caret="circle"
                              >
                                {part.text}
                              </MessageResponse>
                            );
                          }
                          if (part.type === "file" && part.url) {
                            const isImage =
                              part.mediaType?.startsWith("image/") ||
                              part.url.startsWith("data:image/");

                            if (!isImage) {
                              return (
                                <div
                                  key={index}
                                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-1.5 text-xs font-medium"
                                >
                                  <FileTextIcon className="size-3.5 text-muted-foreground" />
                                  <span className="max-w-[200px] truncate">
                                    {part.filename || "Attached document"}
                                  </span>
                                </div>
                              );
                            }

                            if (!isAssistant) {
                              return (
                                <div
                                  key={index}
                                  className="overflow-hidden rounded-xl border border-border bg-background"
                                >
                                  <img
                                    src={part.url}
                                    alt={part.filename || "Uploaded image"}
                                    className="max-h-56 w-auto object-contain"
                                  />
                                </div>
                              );
                            }

                            return (
                              <div key={index} className="space-y-2.5">
                                <div
                                  className={`group/img relative w-fit overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${
                                    isFreshImage ? "chatgpt-image-reveal" : ""
                                  }`}
                                >
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
                  className={`image-skeleton-sweep relative w-full overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-muted via-accent/40 to-secondary shadow-xs ${aspectClassFor(
                    aspectRatio,
                  )}`}
                >
                  <div className="flex size-full flex-col items-center justify-center gap-2.5 p-6 text-center backdrop-blur-xl">
                    <div className="grid size-11 animate-pulse place-items-center rounded-2xl border border-border/60 bg-background/60 shadow-2xs backdrop-blur-sm">
                      <ImageIcon className="size-5 text-muted-foreground/80" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground/85">
                      Generating with {IMAGE_MODELS.find((m) => m.id === imageModel)?.label ?? "AI"}
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
          accept="*/*"
          multiple
          maxFileSize={10 * 1024 * 1024}
          onError={(err) => toast.error(err.message)}
          onSubmit={handleSubmit}
          className="[&_[data-slot=input-group]]:rounded-3xl [&_[data-slot=input-group]]:border-border/90 [&_[data-slot=input-group]]:bg-card [&_[data-slot=input-group]]:shadow-composer [&_[data-slot=input-group]]:transition-all [&_[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_[data-slot=input-group]]:focus-within:border-foreground/25 [&_[data-slot=input-group]]:focus-within:shadow-lg"
        >
          <AttachmentPreviewHeader />
          <PromptInputTextarea
            ref={textareaRef}
            autoFocus
            placeholder={
              mode === "image"
                ? "Describe the image you want to create…"
                : "Ask anything, or attach a file / image…"
            }
            className="min-h-[56px] text-[15px]"
          />
          <PromptInputFooter className="justify-between pt-1">
            <PromptInputTools className="flex-nowrap items-center gap-1.5 overflow-x-auto">
              {mode === "chat" ? (
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger
                    tooltip="Attach files or images"
                    aria-label="Attach files or images"
                    className="size-8 shrink-0 rounded-full border border-border/70 bg-muted/50 text-foreground hover:bg-muted"
                  >
                    <PlusIcon className="size-4" />
                  </PromptInputActionMenuTrigger>
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments label="Upload files or images" />
                    <PromptInputActionAddScreenshot label="Capture screenshot" />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
              ) : null}

              <PromptInputSelect
                value={mode}
                onValueChange={(value) => setMode(value as ComposerMode)}
              >
                <PromptInputSelectTrigger
                  aria-label="Switch mode"
                  className={`h-8 w-auto shrink-0 gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${
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
                      className="h-8 w-auto shrink-0 gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 text-xs"
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
                        className="h-8 w-auto shrink-0 gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 text-xs"
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
      <div className="grid size-20 place-items-center rounded-2xl border border-border bg-card p-2 shadow-composer">
        {mode === "image" ? (
          <WandSparklesIcon className="size-8 text-primary" />
        ) : (
          <img src={mortagiIcon} alt="Mortagi" className="size-full object-contain" />
        )}
      </div>
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {mode === "image" ? "What would you like to create?" : "How can I help today?"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "image"
            ? "Describe any scene — Mortagi generates visuals right here in chat."
            : "Ask anything, upload docs or images, or switch to Image mode below."}
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
