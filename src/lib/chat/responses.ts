import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage, type UIMessage } from "ai";

export const CHAT_MODEL = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";

const SYSTEM_PROMPT = [
  "You are Mortagi, a warm, thoughtful and highly capable AI companion.",
  "Answer with clear, well-structured markdown: short paragraphs, headings and lists when helpful.",
  "Use fenced code blocks with a language tag for code.",
  "Match the user's language and tone; be friendly but never chatty filler.",
].join(" ");

export function streamGatewayChat(
  request: Request,
  messages: ModelMessage[],
  originalMessages: UIMessage[],
  onFinish?: (message: UIMessage) => Promise<void>,
) {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "AI is not configured. Please set GROQ_API_KEY in your .env file." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const model = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";
  const provider = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });

  const result = streamText({
    model: provider.chat(model),
    system: SYSTEM_PROMPT,
    messages,
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages,
    onFinish: async ({ messages: completedMessages }) => {
      const finalMessage = completedMessages.at(-1);
      if (finalMessage?.role === "assistant") await onFinish?.(finalMessage);
    },
  });
}
