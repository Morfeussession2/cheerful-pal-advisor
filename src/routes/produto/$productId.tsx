import { createFileRoute } from "@tanstack/react-router";
import { ProductDetailPage } from "@/components/collection-page";

const validSizes = ["P", "M", "G", "GG", "GGG"];

function ProductDetailRoute() {
  const { productId } = Route.useParams();
  const { tamanho } = Route.useSearch();
  return <ProductDetailPage productId={productId} initialSize={tamanho} />;
}

export const Route = createFileRoute("/produto/$productId")({
  validateSearch: (search: Record<string, unknown>) => ({
    tamanho: typeof search.tamanho === "string" && validSizes.includes(search.tamanho) ? search.tamanho : "P",
  }),
  component: ProductDetailRoute,
  head: () => ({ meta: [{ title: "Detalhes do produto | Reserva" }] }),
});
