import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Sparkles } from "lucide-react";

import { VirtualTryOn, type TryOnProduct } from "@/components/virtual-try-on";
import { Button } from "@/components/ui/button";
import type { SizeChartRow } from "@/lib/size-recommendation";
import type { Watermark } from "@/lib/video-recording";

const SPELHO_LOGO = "/Spelhosvg_Prancheta%201.svg";
const SIZES = ["P", "M", "G", "GG"] as const;
// A tabela da peça é medida na largura. Convertemos ombro e barra para largura
// total/circunferência para comparar com ombros da câmera e cintura estimada.
const SPELHO_SIZE_CHART: readonly SizeChartRow[] = [
  { size: "P", shoulderMaxCm: 50, waistMaxCm: 148 },
  { size: "M", shoulderMaxCm: 52, waistMaxCm: 152 },
  { size: "G", shoulderMaxCm: 54, waistMaxCm: 156 },
  { size: "GG", shoulderMaxCm: 56, waistMaxCm: 160 },
];
const SPELHO_WATERMARK: Watermark = {
  logoUrl: SPELHO_LOGO,
  label: "Spelho",
};

interface SpelhoProduct extends TryOnProduct {
  id: string;
  details: string;
}

const PRODUCTS: SpelhoProduct[] = [
  {
    id: "t-shirt-neo-bxd",
    name: "T-Shirt Oversized NEO BXD",
    imageUrl:
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/374477028/30-l6qsqczlh0.png",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/374477028/30-l6qsqczlh0.png",
    ],
    garment: "top",
    description:
      "Off-white heavyweight cotton T-shirt with a colorful photo-and-graffiti print, ribbed crew neck, dropped shoulders and broad hems. The reference model wears size GG.",
    details:
      "Uma camiseta que não fica tentando desaparecer no look. A T-Shirt Oversized NEO BXD combina a identidade do artista com uma forma ampla e estruturada. Confeccionada em malha 30 fios, tem modelagem quadrada e ampla, bainhas largas e rib canelada de 2,5 cm. O processo de amaciamento e pré-encolhimento garante toque suave e caimento impecável. Composição: 100% algodão. O modelo tem 1,87 m de altura e veste GG.",
    sizes: SIZES,
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "regata-boxy-texturizada",
    name: "Regata Boxy Texturizada",
    imageUrl:
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400734281/9c888909707649ec83f6af79c4fe9ee1-kgmmenxlp7.jpg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400734281/9c888909707649ec83f6af79c4fe9ee1-kgmmenxlp7.jpg",
    ],
    garment: "top",
    description:
      "color: beige and off-white horizontal stripes; material: smooth cotton jersey knit; texture: soft, clean, matte surface with minimal visible grain; proportions: regular-length body with wide shoulder coverage and large arm openings; fit: relaxed, boxy sleeveless fit; construction details: crew ribbed neckline, evenly spaced horizontal stripes, clean hem finishing, and a small embroidered logo near the lower hem.",
    details:
      "Regata confeccionada em malha texturizada, com modelagem boxy, comprimento abaixo da cintura, gola canelada de 2,5 cm e cavas amplas cortadas a fio. Composição: 67% algodão, 29% poliéster e 4% elastano. O tecido garante toque suave e caimento impecável.",
    sizes: SIZES,
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "camiseta-oversized-encorpada",
    name: "Camiseta Oversized Encorpada",
    imageUrl:
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/343496999/foto-1-2zdyse0bc4.jpg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/343496999/foto-1-2zdyse0bc4.jpg",
    ],
    garment: "top",
    description:
      "color: solid off-white / ivory; material: heavyweight cotton jersey; texture: dense, structured, low-stretch fabric; proportions: oversized, boxy silhouette with dropped shoulders; fit: loose oversized fit; construction details: ribbed crew neck, minimalist design, thick fabric that holds its shape and is not very flexible.",
    details:
      "A forma levemente quadrada cria estrutura sem prender o movimento. Confeccionada em malhão encorpado, tem modelagem quadrada e ampla, bainhas largas e rib canelada de 2,5 cm. O processo de amaciamento e pré-encolhimento garante toque suave e caimento impecável. Composição: 100% algodão, com gramatura acima de 280 g/m². O modelo tem 1,85 m de altura e veste G.",
    sizes: SIZES,
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
];

export function SpelhoStorefront() {
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [activeProduct, setActiveProduct] = useState<TryOnProduct | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);

  function startTryOn(product: SpelhoProduct) {
    const size = selectedSizes[product.id];
    if (!size) return;
    setActiveProduct({ ...product, size });
    setTryOnOpen(true);
  }

  return (
    <main className="min-h-svh bg-white text-black selection:bg-black selection:text-white">
      <header className="relative z-10 border-b border-black/10 bg-white">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="/" className="inline-flex items-center gap-2 text-xs text-black/65 transition hover:text-black">
            <ArrowLeft className="size-4" /> Marcas
          </a>
          <img src={SPELHO_LOGO} alt="Spelho" className="h-9 w-36 object-contain" />
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:mb-12 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-black/55">Vista do seu jeito</p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">Peças para experimentar</h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-black/60">Escolha o tamanho e veja como cada peça pode ficar em você, no provador virtual Spelho.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PRODUCTS.map((product, index) => {
            const selectedSize = selectedSizes[product.id];
            return (
              <article key={product.id} className="group overflow-hidden rounded-[26px] border border-black/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-1 hover:border-black/25 hover:shadow-[0_14px_32px_rgba(0,0,0,0.1)]">
                <div className="relative aspect-[4/4.6] overflow-hidden bg-[#e9e7e0] p-4 sm:p-6">
                  <span className="absolute left-5 top-5 z-[1] rounded-full border border-black/10 bg-white px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-black/65">0{index + 1} · Spelho</span>
                  <img src={product.imageUrl} alt={product.name} loading="lazy" className="size-full object-contain transition duration-500 group-hover:scale-[1.025]" />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-medium tracking-tight">{product.name}</h2>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-black/60">{product.details}</p>
                    </div>
                    <ArrowUpRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-black/40" />
                  </div>

                  <fieldset className="mt-5">
                    <legend className="mb-2.5 text-[9px] uppercase tracking-[0.2em] text-black/55">Selecione seu tamanho</legend>
                    <div className="flex flex-wrap gap-2">
                      {SIZES.map((size) => {
                        const isSelected = selectedSize === size;
                        return (
                          <button key={size} type="button" aria-pressed={isSelected} onClick={() => setSelectedSizes((current) => ({ ...current, [product.id]: size }))} className={`grid size-10 place-items-center rounded-full border text-xs transition duration-200 ${isSelected ? "border-black bg-black text-white" : "border-black/20 bg-white text-black/75 hover:border-black/60 hover:bg-black/[0.03]"}`}>
                            {isSelected ? <span className="inline-flex items-center gap-0.5"><Check className="size-3" />{size}</span> : size}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <Button type="button" disabled={!selectedSize} onClick={() => startTryOn(product)} className="mt-5 h-12 w-full rounded-full bg-black text-xs font-medium text-white shadow-none hover:bg-black/80 disabled:bg-black/10 disabled:text-black/35">
                    <Sparkles className="size-4" /> Experimentar virtualmente
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[10px] leading-5 text-black/45">Grade Spelho P–GG. Consulte a tabela de medidas para confirmar a numeração.</p>
      </section>

      {activeProduct ? (
        <VirtualTryOn
          open={tryOnOpen}
          product={activeProduct}
          brand="spelho"
          watermark={SPELHO_WATERMARK}
          onOpenChange={(open) => {
            setTryOnOpen(open);
            if (!open) setActiveProduct(null);
          }}
        />
      ) : null}
    </main>
  );
}
