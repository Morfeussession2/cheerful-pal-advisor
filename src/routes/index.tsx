import { createFileRoute } from "@tanstack/react-router";
import { SpelhoStorefront } from "@/components/spelho-storefront";

export const Route = createFileRoute("/")({
  component: SpelhoStorefront,
  head: () => ({
    meta: [
      { title: "Spelho | Provador Virtual" },
      { name: "description", content: "Conheça a experiência de provador virtual da Spelho." },
      { property: "og:title", content: "Spelho | Provador Virtual" },
      { property: "og:description", content: "Conheça a experiência de provador virtual da Spelho." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});
