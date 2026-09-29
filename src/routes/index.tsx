import { createFileRoute } from "@tanstack/react-router";
import { EditorialStorefront } from "@/components/editorial-storefront";

export const Route = createFileRoute("/")({
  component: EditorialStorefront,
  head: () => ({
    meta: [
      { title: "Reserva | Moda Masculina Autêntica e Estilo Brasileiro" },
      { name: "description", content: "Moda masculina autêntica, novidades, calçados e acessórios com estilo brasileiro." },
      { property: "og:title", content: "Reserva | Moda Masculina Autêntica e Estilo Brasileiro" },
      { property: "og:description", content: "Moda masculina autêntica, novidades, calçados e acessórios com estilo brasileiro." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});
