import { createFileRoute } from "@tanstack/react-router";
import { CollectionPage } from "@/components/collection-page";

function CollectionRoutePage() {
  const { slug } = Route.useParams();
  return <CollectionPage slug={slug} />;
}

export const Route = createFileRoute("/colecoes/$slug")({
  component: CollectionRoutePage,
  head: () => ({ meta: [{ title: "Coleção | Reserva" }] }),
});
