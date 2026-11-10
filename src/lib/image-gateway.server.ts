export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  format: "openai" | "gemini-chat" | "generate-content" | "cloudflare-input";
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
  format: "openai",
};

const gatewayHeaders = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "Lovable-API-Key": apiKey,
  "X-Lovable-AIG-SDK": "fetch",
});

export function generateImage(config: ImageConfig, prompt: string, stream = true) {
  const input: Record<string, unknown> = {
    model: config.model,
    prompt,
    ...(stream ? { stream: true, partial_images: 1 } : {}),
  };
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: { ...gatewayHeaders(config.apiKey), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function editImage(config: ImageConfig, form: FormData) {
  form.set("model", config.model);
  if (form.get("stream") !== "false") {
    form.set("stream", "true");
    if (!form.has("partial_images")) form.set("partial_images", "1");
  } else {
    form.delete("stream");
    form.delete("partial_images");
  }
  return fetch(`${config.baseURL}/v1/images/edits`, {
    method: "POST",
    headers: gatewayHeaders(config.apiKey),
    body: form,
  });
}