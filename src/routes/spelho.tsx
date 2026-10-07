import { createFileRoute } from "@tanstack/react-router";
import { SpelhoStorefront } from "@/components/spelho-storefront";

export const Route = createFileRoute("/spelho")({
  component: SpelhoStorefront,
  head: () => ({
    meta: [
      { title: "Spelho | Provador Virtual" },
      { name: "description", content: "Conheça a nova experiência de provador virtual da Spelho." },
    ],
  }),
});
