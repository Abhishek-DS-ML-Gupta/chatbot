import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { prompt?: string; resolution?: string; aspect_ratio?: string };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return Response.json({ error: "Invalid JSON request body" }, { status: 400 });
        }

        const prompt = payload.prompt?.trim();
        if (!prompt) {
          return Response.json({ error: "prompt is required" }, { status: 400 });
        }

        const apiKey = process.env["CLOUDFLARE_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { error: "CLOUDFLARE_API_KEY is not configured in .env" },
            { status: 500 }
          );
        }

        const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
        if (!accountId) {
          return Response.json(
            {
              error:
                "CLOUDFLARE_ACCOUNT_ID is missing in your .env file. Please add your Cloudflare Account ID (found in Cloudflare Dashboard -> AI Gateway / Workers) to .env to generate images.",
            },
            { status: 400 }
          );
        }

        const gatewayId = process.env["CLOUDFLARE_GATEWAY_ID"]?.trim() || "default";
        const model = process.env["CLOUDFLARE_IMAGE_MODEL"]?.trim() || "klingai/kling-v3-image";

        const resolution = payload.resolution || "1k";
        const aspectRatio = payload.aspect_ratio || "16:9";

        // Try AI Gateway Universal Endpoint first, fall back to direct Workers AI endpoint
        const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/${model}`;
        const directUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

        const requestBody = JSON.stringify({
          prompt,
          resolution,
          aspect_ratio: aspectRatio,
        });

        const headers = {
          Authorization: `Bearer ${apiKey}`,
          "cf-aig-authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        };

        try {
          let response = await fetch(gatewayUrl, {
            method: "POST",
            headers,
            body: requestBody,
          });

          // If Gateway is not found or fails with 404, fall back to direct account AI run endpoint
          if (response.status === 404) {
            response = await fetch(directUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: requestBody,
            });
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            return Response.json(
              { error: `Cloudflare AI returned error (${response.status}): ${errorText}` },
              { status: response.status }
            );
          }

          const contentType = response.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const json = (await response.json()) as {
              result?: { image?: string; [key: string]: unknown };
              [key: string]: unknown;
            };

            const imageBase64 = json.result?.image;
            if (typeof imageBase64 === "string") {
              const dataUrl = imageBase64.startsWith("data:")
                ? imageBase64
                : `data:image/png;base64,${imageBase64}`;
              return Response.json({ success: true, image: dataUrl });
            }

            return Response.json({ success: true, ...json });
          }

          // Binary response (e.g. image/png or image/jpeg)
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mime = contentType.includes("jpeg") ? "image/jpeg" : "image/png";

          return Response.json({
            success: true,
            image: `data:${mime};base64,${base64}`,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to connect to Cloudflare AI";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});

