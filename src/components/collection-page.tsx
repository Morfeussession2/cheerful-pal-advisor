import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, ShoppingBag, Sparkles } from "lucide-react";

import { VirtualTryOn, type TryOnProduct } from "@/components/virtual-try-on";
import { Button } from "@/components/ui/button";

const STORE_URL = "https://www.usereserva.com";
const ASSET_ROOT = "https://lojausereserva.vtexassets.com/assets/vtex.file-manager-graphql/images";
const sizes = ["P", "M", "G", "GG", "GGG"];

const products = [
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

// Fotos de catálogo só da peça, em fundo neutro, usadas como referência no provador.
// Os banners da vitrine têm texto e cenário, o que atrapalha o modelo de try-on.
const TRY_ON_REFERENCE_IMAGES: Partial<Record<Product["id"], string>> = {
  "parka-scott": "https://lojausereserva.vteximg.com.br/arquivos/ids/13338603-1024-1365/0103423036_04.jpg",
  "jaqueta-bomber": "https://lojausereserva.vteximg.com.br/arquivos/ids/12803350-1024-1365/0102055781_04.jpg",
};

function toTryOnProduct(product: Product): TryOnProduct {
  return {
    name: product.name,
    imageUrl: TRY_ON_REFERENCE_IMAGES[product.id] ?? `${ASSET_ROOT}/${product.image}?width=1024&aspect=true&quality=90`,
    garment: product.garment,
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

function SizeSlider({ productName, onBuy, onTryOn }: { productName: string; onBuy: (selectedSize: string) => void; onTryOn: () => void }) {
  const [selectedSize, setSelectedSize] = useState("P");
  const [startIndex, setStartIndex] = useState(0);
  const visibleSizes = sizes.slice(startIndex, startIndex + 4);

  return (
    <div className="grid grid-cols-2 gap-2 bg-background/95 p-2 shadow-sm xl:flex xl:items-center xl:justify-between xl:gap-1" role="group" aria-label={`Tamanhos e ações para ${productName}`}>
      <div className="col-span-2 flex min-w-0 items-center justify-center gap-1 xl:flex-1 xl:justify-start">
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
      <Button type="button" size="sm" className="h-9 w-full rounded-none px-2 text-xs xl:w-auto" onClick={() => onBuy(selectedSize)}>Comprar</Button>
      <Button type="button" size="sm" variant="outline" className="h-9 w-full rounded-none px-2 text-xs xl:w-auto" onClick={onTryOn}><Sparkles className="size-3.5" />Experimentar</Button>
    </div>
  );
}

export function CollectionPage({ slug }: { slug: string }) {
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
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
                  <img src={`${ASSET_ROOT}/${product.image}?width=768&aspect=true&quality=80`} alt={product.name} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                </a>
                <div className="absolute inset-x-0 bottom-0 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <SizeSlider productName={product.name} onBuy={(size) => { window.location.href = `/produto/${product.id}?tamanho=${encodeURIComponent(size)}`; }} onTryOn={() => { setTryOnProduct(product); setTryOnOpen(true); }} />
                </div>
              </div>
              <a href={`/produto/${product.id}`} className="mt-3 block text-xs leading-5 md:text-sm">{product.name}</a>
              <p className="mt-1 text-xs text-muted-foreground">{product.price}</p>
            </article>
          ))}
        </div>
      </section>
      {tryOnProduct ? <VirtualTryOn open={tryOnOpen} product={toTryOnProduct(tryOnProduct)} onOpenChange={setTryOnOpen} /> : null}
    </main>
  );
}

export function ProductDetailPage({ productId, initialSize }: { productId: string; initialSize: string }) {
  const product = products.find((item) => item.id === productId) ?? products[0];
  const [selectedSize, setSelectedSize] = useState(initialSize);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [addedToBag, setAddedToBag] = useState(false);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center border-b border-border px-4 md:px-10">
        <a href="/colecoes/colecao-reserva-all-black" className="flex items-center gap-2 text-sm"><ArrowLeft className="size-4" />Voltar à coleção</a>
        <a href="/" className="ml-auto text-sm font-semibold tracking-wide">RESERVA</a>
      </header>
      <section className="mx-auto grid max-w-[1280px] gap-6 px-4 py-5 md:grid-cols-2 md:gap-12 md:px-10 md:py-10">
        <div className="overflow-hidden bg-muted"><img src={`${ASSET_ROOT}/${product.image}?width=1000&aspect=true&quality=85`} alt={product.name} className="aspect-[4/5] w-full object-cover md:aspect-[3/4]" /></div>
        <div className="py-2 md:py-8">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reserva · Coleção</p>
          <h1 className="mt-2 text-2xl font-medium md:text-3xl">{product.name}</h1>
          <p className="mt-3 text-lg">{product.price}</p>
          <fieldset className="mt-8">
            <legend className="text-sm">Tamanho: <strong>{selectedSize}</strong></legend>
            <div className="mt-3 flex gap-2">{sizes.map((size) => <button key={size} type="button" aria-pressed={selectedSize === size} onClick={() => { setSelectedSize(size); setAddedToBag(false); }} className={`size-11 rounded-full border text-xs ${selectedSize === size ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>{size}</button>)}</div>
          </fieldset>
          <div className="mt-7 flex flex-col gap-3">
            <Button type="button" size="lg" className="h-12 w-full rounded-none" onClick={() => setAddedToBag(true)}><ShoppingBag />{addedToBag ? "Adicionado à sacola" : "Adicionar à sacola"}</Button>
            <Button type="button" size="lg" variant="outline" className="h-12 w-full rounded-none" onClick={() => setTryOnOpen(true)}><Sparkles />Experimentar</Button>
          </div>
          {addedToBag ? <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4" />{product.name} · tamanho {selectedSize} adicionado à sacola.</p> : null}
          <section className="mt-8 border-t border-border pt-6" aria-labelledby="product-details-title">
            <h2 id="product-details-title" className="text-base font-medium">Detalhes do produto</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{product.name}, uma peça versátil da Reserva para compor diferentes combinações. Selecione o tamanho ideal e experimente virtualmente, ao vivo, pela câmera do seu celular.</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Marca</dt><dd>Reserva</dd>
              <dt className="text-muted-foreground">Tamanho selecionado</dt><dd>{selectedSize}</dd>
              <dt className="text-muted-foreground">Referência</dt><dd className="break-all">{product.id}</dd>
            </dl>
          </section>
        </div>
      </section>
      <VirtualTryOn open={tryOnOpen} product={toTryOnProduct(product)} onOpenChange={setTryOnOpen} />
    </main>
  );
}
