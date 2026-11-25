import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { inflateSync } from "node:zlib";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { streamGatewayChat } from "@/lib/chat/responses";

interface RawPart {
  type?: string;
  text?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
}

function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !match[2]) return null;
  return {
    mime: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function extractPdfContent(buffer: Buffer): Promise<string> {
  try {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    const trimmed = text?.trim() ?? "";
    if (trimmed) return trimmed.slice(0, 28000);
  } catch {
    // Fall back to lightweight stream scan below.
  }
  return extractPdfText(buffer);
}

async function extractDocxContent(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim().slice(0, 28000);
  } catch {
    return "";
  }
}

function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of raw.matchAll(streamRegex)) {
    const streamBody = match[1];
    if (!streamBody) continue;
    let text = streamBody;
    try {
      text = inflateSync(Buffer.from(streamBody, "latin1")).toString("latin1");
    } catch {
      // Uncompressed stream; inspect as-is.
    }
    const literals = text.match(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g);
    if (literals) {
      for (const lit of literals) {
        const cleaned = lit
          .slice(1, -1)
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, " ")
          .replace(/\\t/g, " ")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\");
        if (/[a-zA-Z0-9]/.test(cleaned)) chunks.push(cleaned);
      }
    }
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim().slice(0, 24000);
}

function isReadableTextFile(mime: string, filename?: string): boolean {
  if (mime.startsWith("text/")) return true;
  if (
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/typescript" ||
    mime === "application/csv"
  ) {
    return true;
  }
  const ext = filename?.split(".").pop()?.toLowerCase() ?? "";
  return [
    "txt",
    "md",
    "markdown",
    "csv",
    "tsv",
    "json",
    "js",
    "jsx",
    "ts",
    "tsx",
    "py",
    "java",
    "c",
    "cpp",
    "h",
    "cs",
    "go",
    "rs",
    "rb",
    "php",
    "html",
    "css",
    "scss",
    "sql",
    "xml",
    "yaml",
    "yml",
    "toml",
    "ini",
    "env",
    "log",
    "sh",
  ].includes(ext);
}

async function describeImageWithVision(imageUrl: string, userQuestion: string): Promise<string> {
  const apiKey = process.env["CLOUDFLARE_API_KEY"];
  const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
  if (!apiKey || !accountId) {
    return "[Image attached, but vision analysis is not configured on the server.]";
  }

  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Describe this image thoroughly and accurately, including any visible text, numbers, objects, UI elements, or details relevant to the user's question: "${userQuestion || "Describe this image"}"`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return "[Image attached, but visual inspection failed.]";
    }

    const json = (await response.json()) as {
      result?: { response?: string };
    };
    const description = json.result?.response?.trim();
    return description || "[Image attached, no visual description returned.]";
  } catch {
    return "[Image attached, but visual inspection could not be completed.]";
  }
}

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

        const lastIndex = rawMessages.length - 1;
        const messages = await Promise.all(
          (rawMessages as Array<Record<string, unknown>>).map(async (msg, idx) => {
            if (!Array.isArray(msg["parts"]) && typeof msg["content"] === "string") {
              return {
                ...msg,
                parts: [{ type: "text", text: msg["content"] }],
              };
            }

            if (Array.isArray(msg["parts"])) {
              const parts = msg["parts"] as RawPart[];
              const userText = parts
                .filter((p) => p.type === "text" && typeof p.text === "string")
                .map((p) => p.text)
                .join(" ")
                .trim();

              const sanitizedParts = await Promise.all(
                parts.map(async (part) => {
                  if (part.type !== "file" || typeof part.url !== "string") {
                    return part;
                  }

                  if (msg["role"] === "assistant") {
                    return { type: "text", text: "[Generated image]" };
                  }

                  const filename = part.filename || "attachment";
                  const mime = part.mediaType || "";

                  if (mime.startsWith("image/") || part.url.startsWith("data:image/")) {
                    // Analyze the latest user image with vision; summarize older ones to keep history fast.
                    if (idx === lastIndex) {
                      const description = await describeImageWithVision(part.url, userText);
                      return {
                        type: "text",
                        text: `[Attached image "${filename}" — Visual analysis:\n${description}\n]`,
                      };
                    }
                    return { type: "text", text: `[Previously attached image: "${filename}"]` };
                  }

                  const decoded = decodeDataUrl(part.url);
                  if (decoded) {
                    const lowerName = filename.toLowerCase();
                    const isPdf = decoded.mime === "application/pdf" || lowerName.endsWith(".pdf");
                    const isDocx =
                      decoded.mime ===
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                      lowerName.endsWith(".docx");

                    if (isPdf) {
                      const pdfText = await extractPdfContent(decoded.buffer);
                      return {
                        type: "text",
                        text: pdfText
                          ? `[Attached PDF "${filename}" content:\n${pdfText}\n]`
                          : `[Attached PDF "${filename}", but no selectable text could be extracted (it may be a scanned image PDF).]`,
                      };
                    }

                    if (isDocx) {
                      const docxText = await extractDocxContent(decoded.buffer);
                      return {
                        type: "text",
                        text: docxText
                          ? `[Attached DOCX "${filename}" content:\n${docxText}\n]`
                          : `[Attached DOCX "${filename}", but no readable text could be extracted.]`,
                      };
                    }

                    if (isReadableTextFile(decoded.mime, filename)) {
                      const content = decoded.buffer.toString("utf8").slice(0, 28000);
                      return {
                        type: "text",
                        text: `[Attached file "${filename}" content:\n${content}\n]`,
                      };
                    }
                  }

                  return {
                    type: "text",
                    text: `[Attached file "${filename}" (${mime || "binary"})]`,
                  };
                }),
              );

              return { ...msg, parts: sanitizedParts };
            }

            return msg;
          }),
        );

        const uiMessages = messages as unknown as UIMessage[];
        const modelMessages = await convertToModelMessages(uiMessages);
        return streamGatewayChat(request, modelMessages, uiMessages);
      },
    },
  },
});
