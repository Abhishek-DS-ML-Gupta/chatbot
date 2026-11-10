import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImagePayload = { type?: string; b64_json?: string; error?: { message?: string } };

export async function streamImage(
  endpoint: string,
  input: Record<string, unknown> | FormData,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
) {
  const send = (stream: boolean) => {
    const headers = new Headers();
    let body: FormData | string;
    if (input instanceof FormData) {
      const form = new FormData();
      input.forEach((value, name) => form.append(name, value));
      form.set("stream", String(stream));
      if (!stream) form.delete("partial_images");
      body = form;
    } else {
      const payload = { ...input, stream };
      if (!stream) delete payload.partial_images;
      body = JSON.stringify(payload);
      headers.set("Content-Type", "application/json");
    }
    return fetch(endpoint, { method: "POST", headers, body });
  };

  const response = await send(true);
  if (!response.ok || !response.body) {
    throw new Error(`Image request failed (${response.status}): ${await response.text().catch(() => "")}`);
  }
  let sawEvent = false;
  let completed = false;
  let streamError: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImagePayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImagePayload;
      } catch {
        return;
      }
      if (event.event === "error" || payload.type === "error") {
        sawEvent = true;
        streamError = payload.error?.message ?? "Image creation failed";
        return;
      }
      const type = event.event || payload.type;
      if (type !== "image_generation.partial_image" && type !== "image_generation.completed" && type !== "image_edit.partial_image" && type !== "image_edit.completed") return;
      sawEvent = true;
      if (!payload.b64_json) {
        streamError = "The image response contained no image.";
        return;
      }
      const isFinal = type.endsWith(".completed");
      flushSync(() => onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal));
      if (isFinal) completed = true;
    },
  });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parser.feed(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!sawEvent) {
    const replay = await send(false);
    if (!replay.ok) throw new Error(`Image request failed (${replay.status}): ${await replay.text().catch(() => "")}`);
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("The image response contained no image.");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }
  if (!completed) throw new Error("Image creation did not finish. Please start a new request.");
}