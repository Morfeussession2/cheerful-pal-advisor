import {
  ArrowLeft,
  ArrowRight,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

const STORE_URL = "https://www.usereserva.com";
const ASSET_ROOT =
  "https://lojausereserva.vtexassets.com/assets/vtex.file-manager-graphql/images";

const navItems = [
  ["Última Chance", "/dia-do-cliente"],
  ["Novidades", "/colecao-reserva-novidades"],
  ["Masculino", "/colecao-reserva-masculino"],
  ["Infantil", "/mini"],
  ["Calçados", "/calcados"],
  ["Acessórios", "/colecao-reserva-acessorios"],
  ["Esportes", "/colecao-reserva-sprint"],
  ["Personalização", "/faca-vc/criar"],
  ["Outlet", "/colecao-reserva-ofertas"],
] as const;

const heroSlides = [
  {
    desktop: `${ASSET_ROOT}/1a10b6cb-2015-42b6-be54-df5e3979592d___1f918bea474eb3b5b15989c5372fb112.jpg`,
    mobile: `${ASSET_ROOT}/26fc2688-5b11-422a-a613-735987340948___ad576b0627b4595e8c4964b41fb09201.jpg`,
    href: "/colecao-reserva-verao",
    alt: "Coleção de verão Reserva",
  },
  {
    desktop: `${ASSET_ROOT}/127b4b55-350e-4866-b4a7-b9b57f4b34be___c6f850d7a37efe20e29b51fe78e1833b.jpg`,
    mobile: `${ASSET_ROOT}/ee89e104-6981-4622-a05b-90355a8c6ae1___b9c82f5dcbb470e4c58e42898b5d3be3.jpg`,
    href: "/colecao-go-tenis-r-osaka",
    alt: "Tênis R Osaka",
  },
] as const;

const highlights = [
  ["All Black", "/colecao-reserva-all-black", "3d1f2bae-1143-46aa-80fe-3712f39bf2e2___e1ec7902ac974b9d7b7c90090420dafd.jpg"],
  ["Francisco Slide", "/chinelo-rsv-francisco-slide-suede-0104991-040-649638/p", "c58014f4-65ae-4cd9-a145-6f6965d4e98b___0842287d7fed0ac69d5d5f02946021f1.jpg"],
  ["Urban Tech", "/colecao-go-linha-urban-tech", "77207775-b80f-4adc-a33c-6e855669779a___942a94db257365a81d6423796e9a4021.jpg"],
  ["Chinelo Deck", "/colecao-go-chinelo-deck", "1a83d1f7-b613-4649-9b30-af3961ca4039___a7f0a32ec108f7679b63751e4d59355.jpg"],
  ["Magic Touch", "/colecao-mini-magic-touch", "cd163c94-888e-4747-b228-c7ac5485d9e9___1d6c04506e0fbfa9f8976d00b04812.jpg"],
  ["Roupas que brincam", "/colecao-mini-roupas-que-brincam", "c7666d50-fccf-4630-a658-a6a45195d250___5fb5db898053f215f414d1bcbbf1e856.jpg"],
  ["Parka Scott", "/parka-impermeavel-scott-0103423-036-656419/p", "340c6056-588a-47b2-9539-177bc930dd7e___91dc2464415578ab9574d4e8a4bac98a.jpg"],
  ["Texturizadas", "/colecao-reserva-camisetas-texturizadas", "1a1c04e4-2df0-4527-8e89-a321813c4366___a7647190e84ac2f854cf7d6d1070a5f4.jpg"],
  ["Tons terrosos", "/colecao-reserva-tons-terrosos", "0d24ba60-9a8a-45d9-885f-71894ffdebd1___6d57499c5f7ec0c91e2ae028ea4be8ea.jpg"],
] as const;

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-10 shrink-0 place-items-center text-foreground transition-opacity hover:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {children}
    </button>
  );
}

function StoreHeader({ onSearch, onBag }: { onSearch: () => void; onBag: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const logo = `${ASSET_ROOT}/3517f907-b0fa-497e-9c9e-d983f2fb24fc___4fa9c06b65acc2308dc375dfe0cd8778.svg?width=360&aspect=true&quality=8`;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-border/60 bg-background">
        <div className="mx-auto flex h-full max-w-[1920px] items-center gap-5 px-4 md:px-10">
          <IconButton label="Abrir menu" onClick={() => setMenuOpen(true)}><Menu className="size-5 lg:hidden" /><span className="sr-only lg:not-sr-only lg:hidden">Menu</span></IconButton>
          <a href={STORE_URL} aria-label="Reserva" className="shrink-0">
            <img src={logo} alt="Reserva" className="h-8 w-[180px] object-contain object-left" />
          </a>
          <nav aria-label="Menu principal" className="hidden min-w-0 flex-1 lg:block">
            <ul className="flex items-center gap-5 overflow-hidden">
              {navItems.map(([label, href], index) => (
                <li key={href} className="shrink-0">
                  <a href={`${STORE_URL}${href}`} className={index === 0 ? "text-sm text-sale hover:opacity-60" : "text-sm text-foreground hover:opacity-60"}>{label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <IconButton label="Buscar" onClick={onSearch}><Search className="size-5" strokeWidth={1.5} /></IconButton>
            <a href={`${STORE_URL}/login`} aria-label="Entrar" title="Entrar" className="hidden size-10 place-items-center hover:opacity-55 sm:grid"><UserRound className="size-5" strokeWidth={1.5} /></a>
            <IconButton label="Carrinho" onClick={onBag}><ShoppingBag className="size-5" strokeWidth={1.5} /></IconButton>
          </div>
        </div>
      </header>
      <div className={`fixed inset-0 z-50 bg-overlay transition-opacity lg:hidden ${menuOpen ? "visible opacity-100" : "invisible opacity-0"}`} onClick={() => setMenuOpen(false)} aria-hidden={!menuOpen} />
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-md flex-col bg-background transition-transform duration-300 lg:hidden ${menuOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Menu de navegação" aria-hidden={!menuOpen}>
        <div className="grid h-16 grid-cols-[40px_1fr_40px] items-center px-5">
          <span />
          <img src={logo} alt="Reserva" className="mx-auto h-7 w-[120px] object-contain" />
          <IconButton label="Fechar menu" onClick={() => setMenuOpen(false)}><X className="size-5" /></IconButton>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {navItems.map(([label, href], index) => <a key={href} href={`${STORE_URL}${href}`} className={`flex min-h-14 items-center justify-between px-6 text-[13px] uppercase ${index === 0 ? "text-sale" : "text-foreground"}`}><span>{label}</span><ArrowRight className="size-4" strokeWidth={1.4} /></a>)}
        </nav>
        <div className="grid h-16 grid-cols-2 border-t border-border"><a href={`${STORE_URL}/api/io/account#/orders`} className="flex items-center justify-center gap-2 border-r border-border text-xs"><ShoppingBag className="size-4" />Pedidos</a><a href={`${STORE_URL}/login`} className="flex items-center justify-center gap-2 text-xs"><UserRound className="size-4" />Conta</a></div>
      </aside>
    </>
  );
}

function HeroSlider() {
  const [slide, setSlide] = useState(0);
  const current = slide === 1 ? heroSlides[1] : heroSlides[0];
  return (
    <section className="relative mt-16 overflow-hidden" aria-label="Campanhas em destaque">
      <a href={`${STORE_URL}${current.href}`} className="block">
        <picture>
          <source media="(max-width: 768px)" srcSet={current.mobile} />
          <img src={current.desktop} alt={current.alt} className="aspect-[3/4] w-full object-cover md:aspect-[16/9]" fetchPriority="high" />
        </picture>
      </a>
      <button type="button" onClick={() => setSlide((slide + heroSlides.length - 1) % heroSlides.length)} className="absolute left-5 top-1/2 grid size-9 -translate-y-1/2 place-items-center bg-overlay text-overlay-foreground shadow-lg" aria-label="Slide anterior"><ArrowLeft className="size-5" /></button>
      <button type="button" onClick={() => setSlide((slide + 1) % heroSlides.length)} className="absolute right-5 top-1/2 grid size-9 -translate-y-1/2 place-items-center bg-overlay text-overlay-foreground shadow-lg" aria-label="Próximo slide"><ArrowRight className="size-5" /></button>
      <div className="absolute inset-x-0 bottom-5 flex justify-center gap-3" aria-label="Selecionar slide">
        {heroSlides.map((item, index) => <button key={item.href} type="button" aria-label={`Slide ${index + 1}`} onClick={() => setSlide(index)} className={`h-1 bg-overlay-foreground transition-[width,opacity] ${index === slide ? "w-8 opacity-100" : "w-1 opacity-60"}`} />)}
      </div>
    </section>
  );
}

function Highlights() {
  const rail = useRef<HTMLDivElement>(null);
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * 600, behavior: "smooth" });
  return (
    <section className="py-10 pl-4 md:py-16 md:pl-8" aria-labelledby="highlights-title">
      <h2 id="highlights-title" className="mb-5 text-2xl font-medium md:text-3xl">Destaques</h2>
      <div ref={rail} className="grid snap-x auto-cols-[76vw] grid-flow-col gap-2 overflow-x-auto pr-4 [scrollbar-width:none] md:auto-cols-[30vw] md:pr-14">
        {highlights.map(([label, href, file]) => (
          <a key={href} href={`${STORE_URL}${href}`} className="group snap-start overflow-hidden" aria-label={label}>
            <div className="aspect-[3/4] overflow-hidden bg-muted"><img src={`${ASSET_ROOT}/${file}?width=768&aspect=true&quality=80`} alt={label} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" /></div>
          </a>
        ))}
      </div>
      <div className="mt-4 flex gap-1.5">
        <button type="button" aria-label="Destaque anterior" onClick={() => move(-1)} className="grid size-10 place-items-center bg-muted hover:bg-border"><ArrowLeft className="size-4" /></button>
        <button type="button" aria-label="Próximo destaque" onClick={() => move(1)} className="grid size-10 place-items-center bg-muted hover:bg-border"><ArrowRight className="size-4" /></button>
      </div>
    </section>
  );
}

function SidePanel({ type, onClose }: { type: "search" | "bag" | null; onClose: () => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("q"); if (value) window.location.href = `${STORE_URL}/s?q=${encodeURIComponent(String(value))}`; };
  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-50 bg-overlay transition-opacity ${type ? "visible opacity-100" : "invisible opacity-0"}`} />
      <aside className={`fixed inset-y-0 right-0 z-50 w-full bg-background transition-transform duration-300 md:max-w-[520px] ${type ? "translate-x-0" : "translate-x-full"}`} aria-hidden={!type}>
        {type === "search" ? <div className="p-6"><div className="flex items-center justify-between border-b border-border pb-3"><h2 className="text-lg font-medium">Busca de produtos</h2><IconButton label="Fechar busca" onClick={onClose}><X className="size-5" /></IconButton></div><form onSubmit={submit} className="mt-8 flex border-b border-foreground py-3"><input name="q" type="search" placeholder="Buscar" aria-label="Buscar" className="min-w-0 flex-1 bg-transparent text-sm outline-none" autoFocus /><button type="submit" aria-label="Buscar" className="grid size-8 place-items-center"><Search className="size-4" /></button></form><h3 className="mt-10 font-medium">Em alta</h3><div className="mt-5 flex flex-col items-start gap-3 text-[13px]">{["bermuda casual iron", "body", "blusa feminina", "camiseta regular waffle", "camiseta regular careca"].map(term => <button type="button" key={term} onClick={() => window.location.href = `${STORE_URL}/s?q=${encodeURIComponent(term)}`} className="capitalize hover:underline">{term}</button>)}</div></div> : null}
        {type === "bag" ? <div className="flex h-full flex-col"><div className="flex justify-end p-6"><IconButton label="Fechar sacola" onClick={onClose}><X className="size-5" /></IconButton></div><div className="px-7 pt-8 text-center"><h2 className="text-2xl font-medium">Seu minicart está vazio</h2><p className="mt-2 text-sm text-muted-foreground">Você pode explorar pelas nossas marcas ou categorias! Vamos lá!</p><a href={STORE_URL} className="mt-8 flex min-h-12 items-center justify-center bg-primary px-4 text-[13px] text-primary-foreground">Continuar explorando</a></div></div> : null}
      </aside>
    </>
  );
}

export function EditorialStorefront() {
  const [panel, setPanel] = useState<"search" | "bag" | null>(null);
  return <main className="min-h-screen bg-background text-foreground"><StoreHeader onSearch={() => setPanel("search")} onBag={() => setPanel("bag")} /><HeroSlider /><Highlights /><SidePanel type={panel} onClose={() => setPanel(null)} /></main>;
}