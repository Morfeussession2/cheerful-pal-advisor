import { useState } from "react";
import { Sparkles } from "lucide-react";

import { VirtualTryOn, type TryOnProduct } from "@/components/virtual-try-on";
import { Button } from "@/components/ui/button";
import type { SizeChartRow } from "@/lib/size-recommendation";
import type { Watermark } from "@/lib/video-recording";

const SPELHO_LOGO = "/Spelhosvg_Prancheta%201.svg";
const CICLO_LOGO_ICON = "https://cdn.awsli.com.br/400x300/2557/2557100/logo/200x200-logo-02-odthvc.png";
const CICLO_LOGO_WORDMARK = "https://cdn.awsli.com.br/2557/2557100/arquivos/logo-cicloarte.png";
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
  productUrl: string;
  sku: string;
  catalogProductCode: string;
  installmentCount: number;
  installmentAmount: string;
  price: string;
  sellPrice: string;
  pixPrice: string;
  swatchColor: string;
  swatchLabel: string;
}

const PRODUCTS: SpelhoProduct[] = [
  {
    id: "t-shirt-neo-bxd",
    name: "T-SHIRT OVERSIZED NEO BXD",
    productUrl: "https://www.ciclodaarte.com.br/t-shirt-oversized-neo-bxd",
    sku: "1012024562589508776",
    catalogProductCode: "374477028",
    imageUrl:
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/374477028/30-l6qsqczlh0.png",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/374477028/35-k5ixyzewwt.png",
    ],
    garment: "top",
    description:
      "Off-white heavyweight cotton T-shirt with a colorful photo-and-graffiti print, ribbed crew neck, dropped shoulders and broad hems. The reference model wears size GG.",
    details:
      "Uma camiseta que não fica tentando desaparecer no look. A T-Shirt Oversized NEO BXD combina a identidade do artista com uma forma ampla e estruturada. Confeccionada em malha 30 fios, tem modelagem quadrada e ampla, bainhas largas e rib canelada de 2,5 cm. O processo de amaciamento e pré-encolhimento garante toque suave e caimento impecável. Composição: 100% algodão. O modelo tem 1,87 m de altura e veste GG.",
    installmentCount: 6,
    installmentAmount: "R$ 30,83",
    price: "R$ 185,00",
    sellPrice: "185.00",
    pixPrice: "R$ 175,75",
    swatchColor: "#FFFFFF",
    swatchLabel: "Off-white",
    sizes: SIZES,
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "regata-boxy-texturizada",
    name: "REGATA BOXY LISTRAS GISLONS",
    productUrl: "https://www.ciclodaarte.com.br/regata-boxy-listras-gislons",
    sku: "1012024562589509246",
    catalogProductCode: "400734281",
    imageUrl:
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400734281/9c888909707649ec83f6af79c4fe9ee1-kgmmenxlp7.jpg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400734281/6fd47f69ea0f46efbc5f1f6a2e55cb0e-5pja0rlxl7.jpg",
    ],
    garment: "top",
    description:
      "color: beige and off-white horizontal stripes; material: smooth cotton jersey knit; texture: soft, clean, matte surface with minimal visible grain; proportions: regular-length body with wide shoulder coverage and large arm openings; fit: relaxed, boxy sleeveless fit; construction details: crew ribbed neckline, evenly spaced horizontal stripes, clean hem finishing, and a small embroidered logo near the lower hem.",
    details:
      "Regata confeccionada em malha texturizada, com modelagem boxy, comprimento abaixo da cintura, gola canelada de 2,5 cm e cavas amplas cortadas a fio. Composição: 67% algodão, 29% poliéster e 4% elastano. O tecido garante toque suave e caimento impecável.",
    installmentCount: 6,
    installmentAmount: "R$ 30,83",
    price: "R$ 185,00",
    sellPrice: "185.00",
    pixPrice: "R$ 175,75",
    swatchColor: "#C3B091",
    swatchLabel: "Areia e off-white",
    sizes: SIZES,
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "camiseta-oversized-encorpada",
    name: "T-SHIRT OVERSIZED BOXY",
    productUrl: "https://www.ciclodaarte.com.br/t-shirt-oversized-boxy",
    sku: "1012024562589508015",
    catalogProductCode: "343496999",
    imageUrl:
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/343496999/foto-1-2zdyse0bc4.jpg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/343496999/foto-2-fomi1tgtv5.jpg",
    ],
    garment: "top",
    description:
      "color: solid off-white / ivory; material: heavyweight cotton jersey; texture: dense, structured, low-stretch fabric; proportions: oversized, boxy silhouette with dropped shoulders; fit: loose oversized fit; construction details: ribbed crew neck, minimalist design, thick fabric that holds its shape and is not very flexible.",
    details:
      "A forma levemente quadrada cria estrutura sem prender o movimento. Confeccionada em malhão encorpado, tem modelagem quadrada e ampla, bainhas largas e rib canelada de 2,5 cm. O processo de amaciamento e pré-encolhimento garante toque suave e caimento impecável. Composição: 100% algodão, com gramatura acima de 280 g/m². O modelo tem 1,85 m de altura e veste G.",
    installmentCount: 6,
    installmentAmount: "R$ 24,16",
    price: "R$ 145,00",
    sellPrice: "145.00",
    pixPrice: "R$ 137,75",
    swatchColor: "#FFFFFF",
    swatchLabel: "Off-white",
    sizes: SIZES,
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
];

export function SpelhoStorefront() {
  const [activeProduct, setActiveProduct] = useState<TryOnProduct | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);

  function startTryOn(product: SpelhoProduct) {
    setActiveProduct(product);
    setTryOnOpen(true);
  }

  return (
    <main className="pagina-categoria min-h-svh bg-white text-black selection:bg-black selection:text-white">
      <header className="relative z-10 bg-black text-white ">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-center gap-5 px-5 sm:h-[88px] sm:gap-7 sm:px-8">
          <img src={SPELHO_LOGO} alt="Spelho" className="h-8 w-28 object-contain brightness-0 invert sm:h-10" />
          <span aria-hidden="true" className="h-8 w-px bg-white/30 sm:h-10" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <img src={CICLO_LOGO_ICON} alt="" aria-hidden="true" className="h-32 w-32 shrink-0 object-contain brightness-0 invert" />
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="mb-7 flex flex-col justify-between gap-5 border-b border-black/10 pb-5 sm:mb-9 sm:flex-row sm:items-end sm:pb-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-black/55">Vista do seu jeito</p>
            <h1 className="mt-3 text-3xl font-light tracking-tight sm:text-5xl">Peças para experimentar</h1>
          </div>
          <p className="max-w-sm text-sm leading-6 text-black/60">Escolha o tamanho e veja como cada peça pode ficar em você, no provador virtual Spelho.</p>
        </div>

        <div id="listagemProdutos" className="listagem grid grid-cols-2 gap-x-3 gap-y-0 sm:gap-x-5 lg:grid-cols-3 lg:gap-x-7">
          {PRODUCTS.map((product) => {
            const alternateImage = product.imageUrls?.find((url) => url !== product.imageUrl);
            return (
              <article key={product.id} className="listagem-item group relative min-w-0 border-2 border-transparent bg-white p-2.5 transition-colors duration-200 hover:border-black">
                <div className="produto-sobrepor" aria-hidden="true" />
                <div className="relative aspect-[7/10] overflow-hidden bg-[#f4f3f0]">
                  <img src={product.imageUrl} alt={product.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.025] group-hover:opacity-0" />
                  {alternateImage ? (
                    <img
                      src={alternateImage}
                      alt={`${product.name}, outra vista`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = product.imageUrl;
                      }}
                      className="absolute inset-0 size-full object-cover opacity-0 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100"
                    />
                  ) : null}
                </div>
                <div className="info-produto">
                  <div className="cn-cores">
                    <ul>
                      <li
                        role="img"
                        aria-label={`Cor: ${product.swatchLabel}`}
                        title={product.swatchLabel}
                        style={{ background: product.swatchColor }}
                      />
                    </ul>
                  </div>
                  <a className="nome-produto cor-secundaria" href={product.productUrl} target="_blank" rel="noreferrer">
                    {product.name}
                  </a>
                  <div className="produto-sku hide">{product.sku}</div>
                  <div data-trustvox-product-code={product.catalogProductCode} className="hide trustvox-stars" />
                  <div>
                    <div className="preco-produto destaque-parcela">
                      <div>
                        <span className="preco-parcela cor-principal">
                          <strong>{product.installmentCount}x</strong> de <strong className="cor-principal titulo">{product.installmentAmount}</strong>
                        </span>
                      </div>
                      <div style={{ marginTop: "3px" }}>
                        <strong className="preco-promocional cor-principal" data-sell-price={product.sellPrice}>
                          {product.price}
                        </strong>
                      </div>
                      <span className="desconto-a-vista">
                        ou <strong className="cor-secundaria">{product.pixPrice}</strong> via Pix
                      </span>
                    </div>
                  </div>

                </div>
                <Button type="button" onClick={() => startTryOn(product)} className="mt-3 h-10 w-full rounded-none bg-black px-2 text-[9px] font-medium uppercase tracking-[0.08em] text-white shadow-none hover:bg-black/80 sm:h-11 sm:text-[10px] sm:tracking-[0.12em]">
                  <Sparkles className="size-3.5 shrink-0 sm:size-4" /> Experimentar
                </Button>
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
