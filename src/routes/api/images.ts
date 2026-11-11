import { createFileRoute } from "@tanstack/react-router";
import { Client } from "@gradio/client";

export const Route = createFileRoute("/api/images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: {
          prompt?: string;
          resolution?: string;
          aspect_ratio?: string;
          model?: string;
          negative_prompt?: string;
        };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return Response.json({ error: "Invalid JSON request body" }, { status: 400 });
        }

        const prompt = payload.prompt?.trim();
        if (!prompt) {
          return Response.json({ error: "prompt is required" }, { status: 400 });
        }

        const model = payload.model?.trim() || "huggingface/dreamshaper-8";
        const resolution = payload.resolution || "1k";
        const aspectRatio = payload.aspect_ratio || "16:9";

        // ====================================================================
        // 1. Hugging Face Space (Dreamshaper 8 / Custom ZeroGPU Space)
        // ====================================================================
        if (model.includes("huggingface") || model.includes("dreamshaper")) {
          const hfSpace =
            process.env["HUGGINGFACE_SPACE"]?.trim() || "AbhishekGGG/Lykon-dreamshaper-8";
          const hfToken = process.env["HUGGINGFACE_API_KEY"]?.trim();

          try {
            console.log(`Connecting to Hugging Face Space: ${hfSpace}`);
            const app = await Client.connect(hfSpace, {
              token: hfToken ? (hfToken.startsWith("hf_") ? hfToken : `hf_${hfToken}`) : undefined,
            });

            // Map aspect ratio to width & height within 256 - 768 range supported by app.py
            let width = 512;
            let height = 512;
            if (aspectRatio === "16:9") {
              width = 768;
              height = 448;
            } else if (aspectRatio === "9:16") {
              width = 448;
              height = 768;
            }

            // app.py signature:
            // infer(prompt, negative_prompt, seed, randomize_seed, width, height, guidance_scale, num_inference_steps)
            const result = (await app.predict("/infer", [
              prompt,
              payload.negative_prompt || "",
              0,
              true,
              width,
              height,
              7.5,
              30,
            ])) as { data?: unknown[] };

            if (result && Array.isArray(result.data) && result.data[0]) {
              const imgOutput = result.data[0];
              let imageUrl = "";

              if (typeof imgOutput === "string") {
                imageUrl = imgOutput;
              } else if (
                typeof imgOutput === "object" &&
                imgOutput !== null &&
                "url" in imgOutput
              ) {
                imageUrl = (imgOutput as { url: string }).url;
              }

              if (imageUrl) {
                // If it's a remote URL, convert it to a base64 data-URL so it displays reliably
                if (imageUrl.startsWith("http")) {
                  try {
                    const fetchHeaders: Record<string, string> = {};
                    if (hfToken) fetchHeaders["Authorization"] = `Bearer ${hfToken}`;
                    const imgRes = await fetch(imageUrl, { headers: fetchHeaders });
                    if (imgRes.ok) {
                      const buffer = await imgRes.arrayBuffer();
                      const base64 = Buffer.from(buffer).toString("base64");
                      const mime = imgRes.headers.get("content-type") || "image/jpeg";
                      return Response.json({
                        success: true,
                        image: `data:${mime};base64,${base64}`,
                      });
                    }
                  } catch (fetchErr) {
                    console.warn("Could not inline HF image buffer, returning direct URL:", fetchErr);
                  }
                }
                return Response.json({ success: true, image: imageUrl });
              }
            }

            throw new Error("No image data returned from Hugging Face Space.");
          } catch (hfErr) {
            console.error("Hugging Face Space error:", hfErr);
            const msg =
              hfErr instanceof Error
                ? hfErr.message
                : "Failed to connect to Hugging Face Space. Make sure the Space is Public or check your token.";
            return Response.json({ error: msg }, { status: 500 });
          }
        }

        // ====================================================================
        // 2. Cloudflare AI Fallback (Kling v3 / Flux Schnell)
        // ====================================================================
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
                "CLOUDFLARE_ACCOUNT_ID is missing in your .env file. Please add your Cloudflare Account ID to .env.",
            },
            { status: 400 }
          );
        }

        const gatewayId = process.env["CLOUDFLARE_GATEWAY_ID"]?.trim() || "mortagi";

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

            return Response.json({ error: parsedMessage }, { status: response.status });
          }

          const contentType = response.headers.get("content-type") || "";

          // JSON response handling
          if (contentType.includes("application/json")) {
            const json = (await response.json()) as {
              result?: { image?: string; [key: string]: unknown } | string;
              [key: string]: unknown;
            };

            // If image is inside result.image
            if (
              json.result &&
              typeof json.result === "object" &&
              typeof json.result.image === "string"
            ) {
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
          const message =
            error instanceof Error ? error.message : "Failed to connect to Cloudflare AI";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
