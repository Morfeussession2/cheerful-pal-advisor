import { useState } from "react";
import { ShoppingBag, Sparkles } from "lucide-react";

export interface StoreProduct {
  id: string;
  name: string;
  link: string;
  price: number;
  listPrice: number;
  images: string[];
}

export const storeProducts: StoreProduct[] = [
  {
    id: "49538",
    name: "Camiseta Sb Pica Pau Est Meme Escudo",
    link: "https://www.usereserva.com/camiseta-sb-pica-pau-est-meme-escudo-0100167-040/p",
    price: 89,
    listPrice: 169,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12356268/0100167040_01.jpg?v=639076579449200000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12356391/0100167040_04.jpg?v=639076579442170000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12356444/0100167040_05.jpg?v=639076579442170000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12356486/0100167040_06.jpg?v=639076579442500000",
    ],
  },
  {
    id: "60357",
    name: "Camiseta Reserva Mini Brasa Pica-pau Bordado",
    link: "https://www.usereserva.com/camiseta-reserva-mini-brasa-pica-pau-bordado-0035071-040/p",
    price: 89,
    listPrice: 99,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/11698584/0035071040_01.jpg?v=639106700677870000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/11698650/0035071040_02.jpg?v=639106700677700000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/11698704/0035071040_03.jpg?v=639106700679730000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/11698807/0035071040_04.jpg?v=639106700678000000",
    ],
  },
  {
    id: "57724",
    name: "Camiseta Carimbo Gaze",
    link: "https://www.usereserva.com/camiseta-carimbo-gaze-0026693-564/p",
    price: 89,
    listPrice: 139,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12693929/0026693564_01.jpg?v=639148950827870000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12693928/0026693564_02.jpg?v=639148950815530000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12693927/0026693564_03.jpg?v=639148950811500000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12693926/0026693564_04.jpg?v=639148950807600000",
    ],
  },
  {
    id: "13299",
    name: "Camiseta Notificação Reserva",
    link: "https://www.usereserva.com/camiseta-notificacao-reserva-0036015-564/p",
    price: 89,
    listPrice: 119,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985274/0036015564_01.jpg?v=639209426650130000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985264/0036015564_02.jpg?v=639209426642130000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985261/0036015564_03.jpg?v=639209426639630000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985265/0036015564_04.jpg?v=639209426643330000",
    ],
  },
  {
    id: "8988",
    name: "Camiseta Básica Brasa Pica-pau Bordado",
    link: "https://www.usereserva.com/camiseta-basica-brasa-pica-pau-bordado-0034603-040/p",
    price: 129,
    listPrice: 129,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985437/0034603040_01.jpg?v=639209426750500000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985438/0034603040_02.jpg?v=639209426750670000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985436/0034603040_03.jpg?v=639209426748530000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12985435/0034603040_04.jpg?v=639209426748330000",
    ],
  },
  {
    id: "104891",
    name: "Tricot Basico Gola V",
    link: "https://www.usereserva.com/tricot-basico-gola-v-0100603-040/p",
    price: 359.9,
    listPrice: 399,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12794263/0100603040_01.jpg?v=639149059196330000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12794257/0100603040_02.jpg?v=639149059194630000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12794259/0100603040_03.jpg?v=639149059194930000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12794253/0100603040_04.jpg?v=639149059192730000",
    ],
  },
  {
    id: "91769",
    name: "Camiseta Pica-pau Brasileiro",
    link: "https://www.usereserva.com/camiseta-pica-pau-brasileiro-0029952-024/p",
    price: 89.9,
    listPrice: 149,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12969394/0029952024_01.jpg?v=639208437120200000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12969395/0029952024_02.jpg?v=639208437120530000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12969393/0029952024_03.jpg?v=639208437118800000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12969392/0029952024_04.jpg?v=639208437118500000",
    ],
  },
  {
    id: "62986",
    name: "Camisa Mc Pf Oxford Color",
    link: "https://www.usereserva.com/camisa-mc-pf-oxford-color-0046782-040/p",
    price: 224.9,
    listPrice: 449,
    images: [
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12696685/0046782040_01.jpg?v=639148961330900000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12696684/0046782040_02.jpg?v=639148961327770000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12696683/0046782040_03.jpg?v=639148961324630000",
      "https://lojausereserva.vteximg.com.br/arquivos/ids/12696682/0046782040_04.jpg?v=639148961319770000",
    ],
  },
];

const formatPrice = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProductCard({
  product,
  onTryOn,
}: {
  product: StoreProduct;
  onTryOn: (product: StoreProduct) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const currentImage = product.images[imageIndex] ?? product.images[0];
  const hasDiscount = product.listPrice > product.price;

  return (
    <article className="flex min-w-0 flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        <img
          src={currentImage}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {hasDiscount ? (
          <span className="absolute left-2 top-2 bg-sale px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground sm:text-[11px]">
            -{Math.round((1 - product.price / product.listPrice) * 100)}%
          </span>
        ) : null}
      </div>

      {product.images.length > 1 ? (
        <div className="mt-2 flex gap-1.5" aria-label="Fotos do produto">
          {product.images.slice(0, 4).map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setImageIndex(index)}
              aria-label={`Ver foto ${index + 1} de ${product.name}`}
              aria-pressed={index === imageIndex}
              className={`aspect-square w-9 shrink-0 overflow-hidden border sm:w-10 ${index === imageIndex ? "border-foreground" : "border-border opacity-70 hover:opacity-100"}`}
            >
              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <h3 className="mt-3 line-clamp-2 min-h-10 text-[13px] font-medium leading-snug sm:text-sm">
        {product.name}
      </h3>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold sm:text-base">{formatPrice(product.price)}</span>
        {hasDiscount ? (
          <span className="text-[11px] text-muted-foreground line-through sm:text-xs">
            {formatPrice(product.listPrice)}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        <a
          href={product.link}
          className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 bg-primary px-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-85 sm:text-[13px]"
        >
          <ShoppingBag className="size-4 shrink-0" />
          <span className="truncate">Comprar</span>
        </a>
        <button
          type="button"
          onClick={() => onTryOn(product)}
          className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 border border-foreground px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-accent sm:text-[13px]"
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="truncate">Experimentar</span>
        </button>
      </div>
    </article>
  );
}

export function ProductShowcase({ onTryOn }: { onTryOn: (product: StoreProduct) => void }) {
  return (
    <section className="px-4 py-10 md:px-8 md:py-16" aria-labelledby="products-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <h2 id="products-title" className="text-2xl font-medium md:text-3xl">
          Mais vendidos
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Toque em Experimentar para provar com IA
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 lg:grid-cols-4">
        {storeProducts.map((product) => (
          <ProductCard key={product.id} product={product} onTryOn={onTryOn} />
        ))}
      </div>
    </section>
  );
}
