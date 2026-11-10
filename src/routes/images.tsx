import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeftIcon, DownloadIcon, WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/images")({
  component: ImageGenerationPage,
  head: () => ({
    meta: [
      { title: "Image Studio · Mortagi" },
      { name: "description", content: "Create photorealistic visuals and concept art with Mortagi Image Studio." },
    ],
  }),
});



function ImageGenerationPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("klingai/kling-v3-image");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1k");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      toast.error("Please enter a prompt to generate an image.");
      return;
    }

    setLoading(true);
    setGeneratedImage(null);

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model,
          aspect_ratio: aspectRatio,
          resolution,
        }),
      });

      const data = (await response.json()) as { error?: string; image?: string; success?: boolean };

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to generate image.");
      }

      if (data.image) {
        setGeneratedImage(data.image);
        toast.success("Image generated successfully!");
      } else {
        throw new Error("No image data returned from Cloudflare AI.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function downloadImage() {
    if (!generatedImage) return;
    const a = document.createElement("a");
    a.href = generatedImage;
    a.download = `mortagi-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-5 md:px-9">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            onClick={() => void navigate({ to: "/dashboard" })}
          >
            <ArrowLeftIcon />
          </Button>
          <span className="font-display font-semibold tracking-tight">Mortagi Image Studio</span>
        </div>
        <span className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
          klingai/kling-v3-image
        </span>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10 md:py-14">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Turn your imagination into visuals.
          </h1>
          <p className="text-muted-foreground">
            Powered by Cloudflare Workers AI and Kling AI image generation.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="mt-8 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create..."
              rows={4}
              className="w-full resize-none bg-transparent text-base focus:outline-none"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Model:</span>
                  {[
                    { id: "klingai/kling-v3-image", label: "Kling v3" },
                    { id: "@cf/black-forest-labs/flux-1-schnell", label: "Flux Schnell" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModel(m.id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        model === m.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {model.includes("kling") && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Ratio:</span>
                      {(["16:9", "1:1", "9:16"] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            aspectRatio === ratio
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Quality:</span>
                      {(["1k", "2k"] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setResolution(res)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            resolution === res
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <Button type="submit" disabled={loading} className="gap-2">
                <WandSparklesIcon className="size-4" />
                {loading ? "Generating…" : "Generate Image"}
              </Button>
            </div>
          </div>
        </form>

        {loading && (
          <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
            <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 font-medium text-foreground">Creating your image with Cloudflare AI…</p>
            <p className="mt-1 text-xs text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        )}

        {generatedImage && !loading && (
          <div className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Generated Image</h2>
              <Button variant="outline" size="sm" onClick={downloadImage} className="gap-2">
                <DownloadIcon className="size-4" /> Download
              </Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <img
                src={generatedImage}
                alt={prompt}
                className="w-full object-contain"
                loading="eager"
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

