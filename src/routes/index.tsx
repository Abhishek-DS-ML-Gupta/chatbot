import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import mortagiIcon from "@/assets/mortagi.svg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Mortagi — Your AI companion" },
      {
        name: "description",
        content: "Chat with Mortagi, your personal AI companion for conversations, images, and files.",
      },
      { property: "og:title", content: "Mortagi — Your AI companion" },
      {
        property: "og:description",
        content: "Chat with Mortagi, your personal AI companion for conversations, images, and files.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    navigate({ to: user ? "/dashboard" : "/auth", replace: true });
  }, [ready, user, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="grid size-20 place-items-center rounded-2xl border border-border bg-card p-2 shadow-xs">
        <img src={mortagiIcon} alt="Mortagi" className="size-full object-contain" />
      </div>
      <p className="text-sm text-muted-foreground">Opening Mortagi…</p>
    </div>
  );
}
