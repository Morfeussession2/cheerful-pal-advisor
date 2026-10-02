import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, ShoppingBag, Sparkles } from "lucide-react";

import { VirtualTryOn, type TryOnProduct } from "@/components/virtual-try-on";
import type { SizeChartRow } from "@/lib/size-recommendation";
import type { Watermark } from "@/lib/video-recording";
import { Button } from "@/components/ui/button";

const STORE_URL = "https://www.usereserva.com";
const ASSET_ROOT = "https://lojausereserva.vtexassets.com/assets/vtex.file-manager-graphql/images";
const sizes = ["P", "M", "G", "GG", "GGG"];
const shoeSizes = ["33/34", "35/36", "37/38", "39/40", "41/42", "43/44", "45/46"];
const dressSizes = ["P", "M", "G", "GG"];

const products = [
  { id: "vestido-teste", name: "Vestido teste", image: "products/vestido-teste.jpeg", price: "Preço a definir", group: "feminino", garment: "dress" },
  { id: "jaqueta-marambaia-blend", name: "Jaqueta Marambaia Blend", image: "3d1f2bae-1143-46aa-80fe-3712f39bf2e2___e1ec7902ac974b9d7b7c90090420dafd.jpg", price: "R$ 1.599,00", group: "all-black", garment: "top" },
  { id: "camiseta-reserva-all-black", name: "Camiseta Reserva All Black", image: "1a1c04e4-2df0-4527-8e89-a321813c4366___a7647190e84ac2f854cf7d6d1070a5f4.jpg", price: "R$ 299,00", group: "all-black", garment: "top" },
  { id: "tenis-r-osaka", name: "Tênis R Osaka", image: "127b4b55-350e-4866-b4a7-b9b57f4b34be___c6f850d7a37efe20e29b51fe78e1833b.jpg", price: "R$ 599,00", group: "calcados", garment: "shoes" },
  { id: "chinelo-francisco-slide", name: "Chinelo Francisco Slide", image: "c58014f4-65ae-4cd9-a145-6f6965d4e98b___0842287d7fed0ac69d5d5f02946021f1.jpg", price: "R$ 249,00", group: "calcados", garment: "shoes" },
  { id: "camiseta-texturizada", name: "Camiseta Texturizada", image: "1a1c04e4-2df0-4527-8e89-a321813c4366___a7647190e84ac2f854cf7d6d1070a5f4.jpg", price: "R$ 249,00", group: "camisetas-texturizadas", garment: "top" },
  { id: "parka-scott", name: "Parka Scott", image: "340c6056-588a-47b2-9539-177bc930dd7e___91dc2464415578ab9574d4e8a4bac98a.jpg", price: "R$ 899,00", group: "masculino", garment: "top" },
  { id: "chinelo-deck", name: "Chinelo Deck", image: "1a83d1f7-b613-4649-9b30-af3961ca4039___a7f0a32ec108f7679b63751e4d59355.jpg", price: "R$ 199,00", group: "calcados", garment: "shoes" },
  { id: "mini-magic-touch", name: "Roupas Mini Magic Touch", image: "cd163c94-888e-4747-b228-c7ac5485d9e9___1d6c04506e0fbfa9f8976d00b04812.jpg", price: "R$ 179,00", group: "infantil", garment: "top" },
  { id: "camisa-casual-linho", name: "Camisa Casual de Linho", image: "1a1c04e4-2df0-4527-8e89-a321813c4366___a7647190e84ac2f854cf7d6d1070a5f4.jpg", price: "R$ 399,00", group: "all-black", garment: "top" },
  { id: "bermuda-urbana", name: "Bermuda Urbana", image: "77207775-b80f-4adc-a33c-6e855669779a___942a94db257365a81d6423796e9a4021.jpg", price: "R$ 349,00", group: "all-black", garment: "bottom" },
  { id: "camiseta-basica", name: "Camiseta Básica Regular", image: "0d24ba60-9a8a-45d9-885f-71894ffdebd1___6d57499c5f7ec0c91e2ae028ea4be8ea.jpg", price: "R$ 199,00", group: "masculino", garment: "top" },
  { id: "moletom-comfy", name: "Moletom Comfy", image: "1a10b6cb-2015-42b6-be54-df5e3979592d___1f918bea474eb3b5b15989c5372fb112.jpg", price: "R$ 499,00", group: "masculino", garment: "top" },
  { id: "tenis-casual", name: "Tênis Casual Reserva", image: "ee89e104-6981-4622-a05b-90355a8c6ae1___b9c82f5dcbb470e4c58e42898b5d3be3.jpg", price: "R$ 549,00", group: "calcados", garment: "shoes" },
  { id: "chinelo-minimal", name: "Chinelo Minimal", image: "c58014f4-65ae-4cd9-a145-6f6965d4e98b___0842287d7fed0ac69d5d5f02946021f1.jpg", price: "R$ 169,00", group: "calcados", garment: "shoes" },
  { id: "camiseta-pima", name: "Camiseta Pima", image: "c7666d50-fccf-4630-a658-a6a45195d250___5fb5db898053f215f414d1bcbbf1e856.jpg", price: "R$ 279,00", group: "camisetas-texturizadas", garment: "top" },
  { id: "jaqueta-bomber", name: "Jaqueta Bomber Leve", image: "340c6056-588a-47b2-9539-177bc930dd7e___91dc2464415578ab9574d4e8a4bac98a.jpg", price: "R$ 799,00", group: "all-black", garment: "top" },
] as const;

type Product = (typeof products)[number];

// URLs obtidas do catálogo público da Reserva. Cada conjunto contém quatro fotos reais do mesmo item.
const PRODUCT_GALLERIES: Record<Product["id"], readonly string[]> = {
  "jaqueta-marambaia-blend": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338550/0103424040_01.jpg?v=639248281657230000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338549/0103424040_02.jpg?v=639248281656300000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338548/0103424040_03.jpg?v=639248281656000000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338547/0103424040_04.jpg?v=639248281655530000",
  ],
  "camiseta-reserva-all-black": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12970811/0031092024_01.jpg?v=639208440889470000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12970810/0031092024_02.jpg?v=639208440889200000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12970807/0031092024_03.jpg?v=639208440885900000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12970808/0031092024_04.jpg?v=639208440886300000",
  ],
  "tenis-r-osaka": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13489749/0104110020_01.jpg?v=639263122464500000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13489750/0104110020_02.jpg?v=639263122465900000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13489748/0104110020_03.jpg?v=639263122464030000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13489747/0104110020_04.jpg?v=639263122463870000",
  ],
  "chinelo-francisco-slide": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13391878/0104991040_01.jpg?v=639252708094070000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13391877/0104991040_02.jpg?v=639252708093430000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13391876/0104991040_03.jpg?v=639252708093270000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13391875/0104991040_04.jpg?v=639252708092330000",
  ],
  "camiseta-texturizada": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13339924/0103711037_01.jpg?v=639248292590630000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13339923/0103711037_02.jpg?v=639248292590270000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13339922/0103711037_03.jpg?v=639248292588370000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13339920/0103711037_04.jpg?v=639248292587900000",
  ],
  "parka-scott": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338605/0103423036_01.jpg?v=639248281687000000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338604/0103423036_02.jpg?v=639248281685600000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338602/0103423036_03.jpg?v=639248281684670000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13338603/0103423036_04.jpg?v=639248281684830000",
  ],
  "chinelo-deck": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13301785/0104266040_01.jpg?v=639244917497370000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13301784/0104266040_02.jpg?v=639244917495800000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13301783/0104266040_03.jpg?v=639244917495630000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13301782/0104266040_04.jpg?v=639244917495500000",
  ],
  "mini-magic-touch": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13464938/0101535195_01.jpg?v=639261963334970000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13464937/0101535195_02.jpg?v=639261963333870000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13464936/0101535195_03.jpg?v=639261963332470000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13464935/0101535195_04.jpg?v=639261963332130000",
  ],
  "camisa-casual-linho": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12949499/0099010313_01.jpg?v=639203252836830000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12949498/0099010313_02.jpg?v=639203252836370000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12949497/0099010313_03.jpg?v=639203252835430000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12949495/0099010313_04.jpg?v=639203252834670000",
  ],
  "bermuda-urbana": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12824111/0102388040_01.jpg?v=639153256061430000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12824108/0102388040_04.jpg?v=639153256060330000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12824109/0102388040_05.jpg?v=639153256060800000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12824107/0102388040_08.jpg?v=639153256059400000",
  ],
  "camiseta-basica": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12446399/0096482004_01.jpg?v=639072056010470000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12446491/0096482004_02.jpg?v=639072056011270000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12446613/0096482004_03.jpg?v=639072056011730000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12446698/0096482004_04.jpg?v=639072056010330000",
  ],
  "moletom-comfy": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12800095/0101420037_01.jpg?v=639149061392930000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12800097/0101420037_02.jpg?v=639149061393270000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12800090/0101420037_03.jpg?v=639149061392470000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12800077/0101420037_04.jpg?v=639149061390600000",
  ],
  "tenis-casual": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13297963/0061290015_01.jpg?v=639244901461870000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13297965/0061290015_02.jpg?v=639244901462330000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13297962/0061290015_03.jpg?v=639244901461100000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13297964/0061290015_04.jpg?v=639244901462030000",
  ],
  "chinelo-minimal": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13424211/0101525589_01.jpg?v=639253501860200000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13424209/0101525589_02.jpg?v=639253501859400000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13424210/0101525589_03.jpg?v=639253501859700000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/13424208/0101525589_04.jpg?v=639253501858930000",
  ],
  "camiseta-pima": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12451112/0097985411_01.jpg?v=639071897687900000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12451263/0097985411_02.jpg?v=639071897687770000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12451357/0097985411_03.jpg?v=639071897688830000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12451426/0097985411_04.jpg?v=639071897688230000",
  ],
  "jaqueta-bomber": [
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12803370/0102055781_01.jpg?v=639149062493670000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12803366/0102055781_02.jpg?v=639149062493200000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12803356/0102055781_03.jpg?v=639149062491970000",
    "https://lojausereserva.vteximg.com.br/arquivos/ids/12803350/0102055781_04.jpg?v=639149062491500000",
  ],
  "vestido-teste": ["/products/vestido-teste.jpeg"],
};

function productGallery(product: Product) {
  return PRODUCT_GALLERIES[product.id];
}

function productSizes(product: Product) {
  if (product.garment === "shoes") return shoeSizes;
  if (product.garment === "dress") return dressSizes;
  return sizes;
}

// Tabela de medidas do CORPO por tamanho, usada na recomendação de tamanho do provador.
// ATENÇÃO: é uma tabela padrão de moda masculina brasileira, não a oficial da Reserva
// (o site não publica a deles). Substituir pelos números oficiais antes de ir para produção.
const SIZE_CHART: readonly SizeChartRow[] = [
  { size: "P", chestMaxCm: 95, waistMaxCm: 83 },
  { size: "M", chestMaxCm: 103, waistMaxCm: 91 },
  { size: "G", chestMaxCm: 111, waistMaxCm: 99 },
  { size: "GG", chestMaxCm: 119, waistMaxCm: 107 },
  { size: "GGG", chestMaxCm: 127, waistMaxCm: 115 },
];

// Marca gravada no canto inferior direito dos vídeos do provador (vai junto quando o cliente compartilha).
const TRY_ON_WATERMARK: Watermark = {
  logoUrl: `${ASSET_ROOT}/3517f907-b0fa-497e-9c9e-d983f2fb24fc___4fa9c06b65acc2308dc375dfe0cd8778.svg`,
  label: "Reserva",
};

// Dados do catálogo da Reserva para o provador: foto só da peça, em fundo neutro, e a
// descrição (em inglês, para o prompt) com cor, tecido, modelagem e detalhes da ficha.
// Os banners da vitrine têm texto e cenário, o que atrapalha o modelo de try-on.
const TRY_ON_DETAILS: Partial<Record<Product["id"], { description: string }>> = {
  "vestido-teste": {
    description:
      "a long black fitted dress made from biodegradable Amni Soul Eco polyamide swimwear fabric with UV 50+ protection, featuring a straight neckline, gathered ruching at the center front of the bust, and thin straps extending from the center of the bust and tying at the neck",
  },
  "parka-scott": {
    description:
      "a mustard yellow waterproof parka jacket in lightweight matte polyester, regular fit, worn zipped closed, with an attached hood, a tall stand collar, a snap-button placket over the front zipper and four flap pockets on the chest and waist",
  },
  "jaqueta-bomber": {
    description:
      "a caramel brown bomber jacket in lightweight matte polyester, regular fit, worn zipped closed, with a stand-up collar, a full-length front zipper and elastic cuffs and hem",
  },
};

const PRODUCT_DESCRIPTIONS: Partial<Record<Product["id"], string>> = {
  "vestido-teste":
    "Vestido de comprimento midi, decote reto e detalhe franzido na frente. Possui alças finas saindo do centro do busto para amarração no pescoço e comprimento logo abaixo do umbigo. Produzido em tecido de biquíni de poliamida biodegradável Amni Soul Eco® e com proteção UV 50+ contra raios ultravioleta.",
};

function toTryOnProduct(product: Product, size: string): TryOnProduct {
  const details = TRY_ON_DETAILS[product.id];
  const imageUrls = productGallery(product);
  return {
    name: product.name,
    imageUrl: imageUrls[0]!,
    imageUrls,
    description: details?.description,
    garment: product.garment,
    sizeChart: product.garment === "shoes" || product.garment === "dress" ? undefined : SIZE_CHART,
    sizes: productSizes(product),
    size,
  };
}

function displayCollectionName(slug: string) {
  const cleaned = slug.replace(/^colecao-/, "").replace(/^(reserva|go|mini)-/, "").replaceAll("-", " ");
  return cleaned.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function productGroup(slug: string) {
  const normalized = slug.replace(/^colecao-/, "").replace(/^(reserva|go|mini)-/, "");
  return normalized === "mini" ? "infantil" : normalized;
}

function SizeSlider({ productName, sizeOptions, onBuy, onTryOn }: { productName: string; sizeOptions: readonly string[]; onBuy: (selectedSize: string) => void; onTryOn: (selectedSize: string) => void }) {
  const [selectedSize, setSelectedSize] = useState(sizeOptions[0] ?? "P");
  const [startIndex, setStartIndex] = useState(0);
  const visibleSizes = sizeOptions.slice(startIndex, startIndex + 4);

  return (
    <div className="grid grid-cols-1 gap-1.5 bg-background/95 p-2 shadow-sm sm:grid-cols-2 xl:flex xl:items-center xl:justify-between xl:gap-1" role="group" aria-label={`Tamanhos e ações para ${productName}`}>
      <div className="flex min-w-0 items-center justify-center gap-1 sm:col-span-2 xl:flex-1 xl:justify-start">
        <div className="flex min-w-0 items-center gap-1 overflow-hidden" aria-label={`Selecione o tamanho de ${productName}`}>
          {visibleSizes.map((size) => (
            <button key={size} type="button" aria-label={`Tamanho ${size}`} aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)} className={`grid size-8 shrink-0 place-items-center rounded-full border text-[10px] ${selectedSize === size ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground"}`}>
              {size}
            </button>
          ))}
        </div>
        {startIndex > 0 ? <button type="button" aria-label="Tamanhos anteriores" onClick={() => setStartIndex(0)} className="grid size-7 shrink-0 place-items-center"><ArrowLeft className="size-3.5" /></button> : null}
        {startIndex === 0 ? <button type="button" aria-label="Próximos tamanhos" onClick={() => setStartIndex(1)} className="grid size-7 shrink-0 place-items-center"><ChevronRight className="size-3.5" /></button> : null}
      </div>
      <Button type="button" size="sm" className="h-9 min-w-0 w-full rounded-none px-2 text-[11px] sm:text-xs xl:w-auto" onClick={() => onBuy(selectedSize)}>Comprar</Button>
      <Button type="button" size="sm" variant="outline" className="h-9 min-w-0 w-full rounded-none px-1.5 text-[11px] sm:px-2 sm:text-xs xl:w-auto" onClick={() => onTryOn(selectedSize)}><Sparkles className="size-3.5" /><span className="sm:hidden">Provar</span><span className="hidden sm:inline">Experimentar</span></Button>
    </div>
  );
}

export function CollectionPage({ slug }: { slug: string }) {
  const [tryOn, setTryOn] = useState<{ product: Product; size: string } | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const title = displayCollectionName(slug);
  const matches = products.filter((product) => product.group === productGroup(slug));
  const remainingProducts = products.filter((product) => !matches.includes(product));
  const collectionProducts = [...matches, ...remainingProducts].slice(0, 12);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center border-b border-border px-4 md:px-10">
        <a href="/" aria-label="Voltar à vitrine" className="flex items-center gap-2 text-sm"><ArrowLeft className="size-4" />Reserva</a>
        <span className="ml-auto text-xs uppercase tracking-[0.16em] text-muted-foreground">Coleção</span>
      </header>
      <section className="mx-auto max-w-[1600px] px-4 py-7 md:px-8 md:py-10">
        <h1 className="text-2xl font-medium md:text-3xl">{title}</h1>
        <div className="mt-6 grid grid-cols-2 gap-x-2 gap-y-8 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4">
          {collectionProducts.map((product) => (
            <article key={product.name} className="group min-w-0">
              <div className="relative">
                <a href={`/produto/${product.id}`} aria-label={`Abrir ${product.name}`} className="block overflow-hidden bg-muted">
                  <img src={productGallery(product)[0]} alt={product.name} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                </a>
                <div className="absolute inset-x-0 bottom-0 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <SizeSlider productName={product.name} sizeOptions={productSizes(product)} onBuy={(size) => { window.location.href = `/produto/${product.id}?tamanho=${encodeURIComponent(size)}`; }} onTryOn={(size) => { setTryOn({ product, size }); setTryOnOpen(true); }} />
                </div>
              </div>
              <a href={`/produto/${product.id}`} className="mt-3 block text-xs leading-5 md:text-sm">{product.name}</a>
              <p className="mt-1 text-xs text-muted-foreground">{product.price}</p>
            </article>
          ))}
        </div>
      </section>
      {tryOn ? <VirtualTryOn open={tryOnOpen} product={toTryOnProduct(tryOn.product, tryOn.size)} watermark={TRY_ON_WATERMARK} onOpenChange={setTryOnOpen} /> : null}
    </main>
  );
}

export function ProductDetailPage({ productId, initialSize }: { productId: string; initialSize: string }) {
  const product = products.find((item) => item.id === productId) ?? products[0];
  const galleryImages = productGallery(product);
  const sizeOptions = productSizes(product);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState(sizeOptions.includes(initialSize) ? initialSize : (sizeOptions[0] ?? "P"));
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [addedToBag, setAddedToBag] = useState(false);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center border-b border-border px-4 md:px-10">
        <a href="/colecoes/colecao-reserva-all-black" className="flex items-center gap-2 text-sm"><ArrowLeft className="size-4" />Voltar à coleção</a>
        <a href="/" className="ml-auto text-sm font-semibold tracking-wide">RESERVA</a>
      </header>
      <section className="mx-auto grid max-w-[1280px] gap-6 px-4 py-5 md:grid-cols-2 md:gap-12 md:px-10 md:py-10">
        <div className="min-w-0">
          <div className="overflow-hidden bg-muted">
            <img src={galleryImages[selectedImageIndex] ?? galleryImages[0]} alt={product.name} className="aspect-[4/5] w-full object-cover md:aspect-[3/4]" />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={`Fotos de ${product.name}`}>
            {galleryImages.map((imageUrl, index) => (
              <button key={imageUrl} type="button" aria-label={`Ver foto ${index + 1} de ${product.name}`} aria-pressed={selectedImageIndex === index} onClick={() => setSelectedImageIndex(index)} className={`size-16 shrink-0 overflow-hidden border-2 ${selectedImageIndex === index ? "border-foreground" : "border-transparent"}`}>
                <img src={imageUrl} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="py-2 md:py-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reserva · Coleção</p>
          <h1 className="mt-2 text-2xl font-medium md:text-3xl">{product.name}</h1>
          <p className="mt-3 text-lg">{product.price}</p>
          <fieldset className="mt-8">
            <legend className="text-sm">Tamanho: <strong>{selectedSize}</strong></legend>
            <div className="mt-3 flex flex-wrap gap-2">{sizeOptions.map((size) => <button key={size} type="button" aria-pressed={selectedSize === size} onClick={() => { setSelectedSize(size); setAddedToBag(false); }} className={`min-h-11 min-w-11 rounded-full border px-2 text-xs ${selectedSize === size ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>{size}</button>)}</div>
          </fieldset>
          <div className="mt-7 flex flex-col gap-3">
            <Button type="button" size="lg" className="h-12 w-full rounded-none" onClick={() => setAddedToBag(true)}><ShoppingBag />{addedToBag ? "Adicionado à sacola" : "Adicionar à sacola"}</Button>
            <Button type="button" size="lg" variant="outline" className="h-12 w-full rounded-none" onClick={() => setTryOnOpen(true)}><Sparkles />Experimentar</Button>
          </div>
          {addedToBag ? <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4" />{product.name} · tamanho {selectedSize} adicionado à sacola.</p> : null}
          <section className="mt-8 border-t border-border pt-6" aria-labelledby="product-details-title">
            <h2 id="product-details-title" className="text-base font-medium">Detalhes do produto</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{PRODUCT_DESCRIPTIONS[product.id] ?? `${product.name}, uma peça versátil da Reserva para compor diferentes combinações.`} Selecione o tamanho ideal e experimente virtualmente, ao vivo, pela câmera do seu celular.</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Marca</dt><dd>Reserva</dd>
              <dt className="text-muted-foreground">Tamanho selecionado</dt><dd>{selectedSize}</dd>
              <dt className="text-muted-foreground">Referência</dt><dd className="break-all">{product.id}</dd>
            </dl>
          </section>
        </div>
      </section>
      <VirtualTryOn open={tryOnOpen} product={toTryOnProduct(product, selectedSize)} watermark={TRY_ON_WATERMARK} onOpenChange={setTryOnOpen} />
    </main>
  );
}
