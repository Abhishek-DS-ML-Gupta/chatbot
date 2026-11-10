import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { prompt?: string; resolution?: string; aspect_ratio?: string; model?: string };
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
                "CLOUDFLARE_ACCOUNT_ID is missing in your .env file. Please add your Cloudflare Account ID to .env to generate images.",
            },
            { status: 400 }
          );
        }

        const gatewayId = process.env["CLOUDFLARE_GATEWAY_ID"]?.trim() || "mortagi";
        const model = payload.model?.trim() || process.env["CLOUDFLARE_IMAGE_MODEL"]?.trim() || "klingai/kling-v3-image";

        const resolution = payload.resolution || "1k";
        const aspectRatio = payload.aspect_ratio || "16:9";

        // Build input based on model
        const input: Record<string, unknown> = { prompt };
        if (model.includes("kling")) {
          input["resolution"] = resolution;
          input["aspect_ratio"] = aspectRatio;
        }

        const requestBody = JSON.stringify({
          model,
          input,
        });

        const directUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;

        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiKey}`,
          "cf-aig-authorization": `Bearer ${apiKey}`,
          "cf-aig-gateway-id": gatewayId,
          "Content-Type": "application/json",
        };

        try {
          const response = await fetch(directUrl, {
            method: "POST",
            headers,
            body: requestBody,
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            let parsedMessage = errorText;
            try {
              const errJson = JSON.parse(errorText) as { errors?: Array<{ message?: string }> };
              if (errJson.errors?.[0]?.message) {
                parsedMessage = errJson.errors[0].message;
              }
            } catch {}

            return Response.json(
              { error: parsedMessage },
              { status: response.status }
            );
          }

          const contentType = response.headers.get("content-type") || "";

          // JSON response handling
          if (contentType.includes("application/json")) {
            const json = (await response.json()) as {
              result?: { image?: string; [key: string]: unknown } | string;
              [key: string]: unknown;
            };

            // If image is inside result.image
            if (json.result && typeof json.result === "object" && typeof json.result.image === "string") {
              const dataUrl = json.result.image.startsWith("data:")
                ? json.result.image
                : `data:image/jpeg;base64,${json.result.image}`;
              return Response.json({ success: true, image: dataUrl });
            }

            // If result is directly a base64 string
            if (typeof json.result === "string") {
              const dataUrl = json.result.startsWith("data:")
                ? json.result
                : `data:image/jpeg;base64,${json.result}`;
              return Response.json({ success: true, image: dataUrl });
            }

            return Response.json({ success: true, ...json });
          }

          // Binary response handling (image/png or image/jpeg)
          const arrayBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mime = contentType.includes("png") ? "image/png" : "image/jpeg";

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
