import { createFileRoute } from "@tanstack/react-router";
import { MockupSelector } from "@/components/mockup-selector";

export const Route = createFileRoute("/")({
  component: MockupSelector,
  head: () => ({
    meta: [
      { title: "Provador Virtual | Escolha sua marca" },
      { name: "description", content: "Escolha entre as experiências de provador virtual Reserva e Spelho." },
      { property: "og:title", content: "Provador Virtual | Escolha sua marca" },
      { property: "og:description", content: "Escolha entre as experiências de provador virtual Reserva e Spelho." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});
