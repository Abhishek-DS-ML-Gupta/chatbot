import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { streamGatewayChat } from "@/lib/chat/responses";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { messages?: unknown };
        try {
          payload = (await request.json()) as { messages?: unknown };
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const rawMessages = payload.messages;
        if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
          return Response.json({ error: "messages array is required" }, { status: 400 });
        }

        const messages = (rawMessages as Array<Record<string, unknown>>).map((msg) => {
          if (!Array.isArray(msg["parts"]) && typeof msg["content"] === "string") {
            return {
              ...msg,
              parts: [{ type: "text", text: msg["content"] }],
            };
          }
          return msg;
        }) as UIMessage[];

        const modelMessages = await convertToModelMessages(messages);
        return streamGatewayChat(request, modelMessages, messages);
      },
    },
  },
});
