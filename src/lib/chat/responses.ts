import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage, type UIMessage } from "ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";

const LOVABLE_AI_GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev";
export const CHAT_MODEL = "openai/gpt-6-astra";

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
  const groqApiKey = process.env["GROQ_API_KEY"];
  const lovableApiKey = process.env["LOVABLE_API_KEY"];

  if (groqApiKey) {
    const groqModel = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";
    const provider = createOpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: groqApiKey,
    });

    const result = streamText({
      model: provider.chat(groqModel),
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

  if (!lovableApiKey) {
    return new Response(
      JSON.stringify({ error: "AI is not configured. Please set GROQ_API_KEY or LOVABLE_API_KEY in your .env file." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const baseURL = `${LOVABLE_AI_GATEWAY_BASE_URL.replace(/\/+$/, "")}/v1`;
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL,
    apiKey: lovableApiKey,
    headers: { "Lovable-API-Key": lovableApiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(CHAT_MODEL),
    system: SYSTEM_PROMPT,
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      sendReasoning: true,
      originalMessages,
      onFinish: async ({ messages: completedMessages }) => {
        const finalMessage = completedMessages.at(-1);
        if (finalMessage?.role === "assistant") await onFinish?.(finalMessage);
      },
    }),
    runIdFetch,
  );
}
