import { useState } from "react";
import { ChevronLeft, ChevronRight, Ruler, Sparkles } from "lucide-react";

import { VirtualTryOn, type TryOnProduct } from "@/components/virtual-try-on";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { SizeChartRow } from "@/lib/size-recommendation";
import type { Watermark } from "@/lib/video-recording";

const SPELHO_LOGO = "/Spelhosvg_Prancheta%201.svg";
const CICLO_LOGO_ICON = "https://cdn.awsli.com.br/400x300/2557/2557100/logo/200x200-logo-02-odthvc.png";
const CICLO_LOGO_WORDMARK = "https://cdn.awsli.com.br/2557/2557100/arquivos/logo-cicloarte.png";
const SIZE_CHART_IMAGE = "https://cdn.awsli.com.br/2557/2557100/arquivos/t-shirt-oversized-boxy.jpg";
const PRODUCT_GALLERY_PAGE_SIZE = 9;
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
  collectionLabel: string;
  genderLabel?: string;
  productUrl: string;
  sku: string;
  catalogProductCode: string;
  installmentCount: number;
  installmentAmount: string;
  price: string;
  sellPrice: string;
  pixPrice: string;
  colors: readonly [SpelhoColorOption, ...SpelhoColorOption[]];
}

interface SpelhoColorOption {
  id: string;
  label: string;
  swatchColor: string;
  /** Descrição da cor em inglês, enviada junto com a descrição da peça ao prompt. */
  promptColor: string;
  imageUrl?: string;
  imageUrls?: readonly string[];
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
    collectionLabel: "COLLAB NEO + CÏCLOarte - MERCH OFICIAL",
    genderLabel: "Unissex",
    description:
      "Heavyweight cotton T-shirt with a colorful photo-and-graffiti print, ribbed crew neck, dropped shoulders and broad hems. The reference model wears size GG.",
    details:
      "Uma camiseta que não fica tentando desaparecer no look. A T-Shirt Oversized NEO BXD combina a identidade do artista com uma forma ampla e estruturada. Confeccionada em malha 30 fios, tem modelagem quadrada e ampla, bainhas largas e rib canelada de 2,5 cm. O processo de amaciamento e pré-encolhimento garante toque suave e caimento impecável. Composição: 100% algodão. O modelo tem 1,87 m de altura e veste GG.",
    installmentCount: 6,
    installmentAmount: "R$ 30,83",
    price: "R$ 185,00",
    sellPrice: "185.00",
    pixPrice: "R$ 175,75",
    colors: [
      { id: "off-white", label: "Off-white", swatchColor: "#FFFFFF", promptColor: "off-white" },
    ],
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
    collectionLabel: "COLLAB GILSONS + CÏCLOARTE - MERCH OFICIAL DO ÁLBUM “EU VEJO LUZ”",
    genderLabel: "Unissex",
    description:
      "Material: smooth cotton jersey knit; texture: soft, clean, matte surface with minimal visible grain; proportions: regular-length body with wide shoulder coverage and large arm openings; fit: relaxed, boxy sleeveless fit; construction details: crew ribbed neckline, evenly spaced horizontal stripes, clean hem finishing, and a small embroidered logo near the lower hem.",
    details:
      "Regata confeccionada em malha texturizada, com modelagem boxy, comprimento abaixo da cintura, gola canelada de 2,5 cm e cavas amplas cortadas a fio. Composição: 67% algodão, 29% poliéster e 4% elastano. O tecido garante toque suave e caimento impecável.",
    installmentCount: 6,
    installmentAmount: "R$ 30,83",
    price: "R$ 185,00",
    sellPrice: "185.00",
    pixPrice: "R$ 175,75",
    colors: [
      { id: "areia-off-white", label: "Areia e off-white", swatchColor: "#C3B091", promptColor: "beige and off-white horizontal stripes" },
    ],
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
    collectionLabel: "BÁSICOS COM ARTE - MODELAGENS AUTORAIS EM MALHAS PREMIUM",
    genderLabel: "Unissex",
    description:
      "Material: heavyweight cotton jersey; texture: dense, structured, low-stretch fabric; proportions: oversized, boxy silhouette with dropped shoulders; fit: loose oversized fit; construction details: ribbed crew neck, minimalist design, thick fabric that holds its shape and is not very flexible.",
    details:
      "A forma levemente quadrada cria estrutura sem prender o movimento. Confeccionada em malhão encorpado, tem modelagem quadrada e ampla, bainhas largas e rib canelada de 2,5 cm. O processo de amaciamento e pré-encolhimento garante toque suave e caimento impecável. Composição: 100% algodão, com gramatura acima de 280 g/m². O modelo tem 1,85 m de altura e veste G.",
    installmentCount: 6,
    installmentAmount: "R$ 24,16",
    price: "R$ 145,00",
    sellPrice: "145.00",
    pixPrice: "R$ 137,75",
    colors: [
      { id: "off-white", label: "Off-white", swatchColor: "#FFFFFF", promptColor: "solid off-white / ivory" },
    ],
    sizes: SIZES,
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "t-shirt-stone-dan",
    name: "T-SHIRT STONE DAN",
    productUrl: "https://www.ciclodaarte.com.br/t-shirt-stone-dan",
    sku: "1012024562589508850",
    catalogProductCode: "399104767",
    imageUrl: "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/399104767/21-5qtjp9we8z.png",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/399104767/18-9v0jerp5cw.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/399104767/23-opaajj4r9m.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/399104767/20-m4lgnef547.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/399104767/17-34c5ji1stj.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/399104767/19-1545jjhxgf.png",
    ],
    garment: "top",
    collectionLabel: "COLLAB LUEDJI LUNA + CÏCLOarte - MERCH OFICIAL DO ÁLBUM LL4",
    genderLabel: "Masculino",
    description: "Stonewashed cotton T-shirt with a relaxed square fit, wide hems and a 2.5 cm ribbed neckline. The washing process creates a vintage finish and natural color variations.",
    details: "A estampa traz o título dos dois últimos álbuns de Luedji Luna: “Um Mar Pra Cada Um” e “Antes Que a Terra Acabe”. Feita em meia malha 30.1, tem modelagem square ampla, bainhas largas e gola canelada de 2,5 cm. A peça é pré-encolhida, amaciada e passa por lavagem estonada, que cria um visual vintage, toque macio e variações naturais de tonalidade. Composição: 100% algodão. O modelo tem 1,88 m e veste GG.",
    installmentCount: 6,
    installmentAmount: "R$ 32,50",
    price: "R$ 195,00",
    sellPrice: "195.00",
    pixPrice: "R$ 185,25",
    colors: [
      { id: "marrom", label: "Marrom", swatchColor: "#B45F06", promptColor: "brown stonewashed cotton with natural tonal variations" },
    ],
    sizes: ["P", "M", "G", "GG", "XGG"],
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "bone-um-mar-para-cada-um",
    name: "BONÉ UM MAR PARA CADA UM",
    productUrl: "https://www.ciclodaarte.com.br/bone-um-mar-para-cada-um",
    sku: "1012024562589508352",
    catalogProductCode: "357984631",
    imageUrl: "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357984631/1-arrsf0l509.png",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357984631/foto-2-f6dxlea2p3.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357984631/foto-3-auxegc3dra.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357984631/foto-4-v5p7x5k7a7.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357984631/foto-5-vn6imylj9q.png",
    ],
    garment: "headwear",
    collectionLabel: "COLLAB LUEDJI LUNA + CÏCLOarte - MERCH OFICIAL DO ÁLBUM LL4",
    description: "Cotton dad hat with a curved brim, an embroidered album title and an adjustable circumference from 54 to 61 cm.",
    details: "O título do quarto álbum de Luedji Luna aparece bordado em uma peça para usar muito além do lançamento. Modelo dad hat com aba curva, em algodão amaciado. Tamanho ajustável: 54 a 61 cm de circunferência. Composição: 100% algodão. Arte: Guile Farias.",
    installmentCount: 6,
    installmentAmount: "R$ 22,50",
    price: "R$ 135,00",
    sellPrice: "135.00",
    pixPrice: "R$ 128,25",
    colors: [
      { id: "preto", label: "Preto", swatchColor: "#000000", promptColor: "black" },
    ],
    sizes: ["U"],
    size: "U",
  },
  {
    id: "t-shirt-barra-obelia-ll4",
    name: "T-SHIRT BARRA OBELIA LL4",
    productUrl: "https://www.ciclodaarte.com.br/t-shirt-barra-obelia-ll4",
    sku: "1012024562589508341",
    catalogProductCode: "357276757",
    imageUrl: "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/5-9u0bbzqyxq.jpg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/4-hp3grtlq1x.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/151-3n19od6jv2.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/142-83vipyomtc.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/145-ko8nbo0emq.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/147-9qjrz2w15n.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/148-91abuh5daz.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/146-zlnrlab7o0.png",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/357276757/150-i0vcit0rga.png",
    ],
    garment: "top",
    collectionLabel: "COLLAB LUEDJI LUNA + CÏCLOarte - MERCH OFICIAL DO ÁLBUM LL4",
    genderLabel: "Unissex",
    description: "Cotton T-shirt with a front deep-sea hydromedusa print and the album title on the back. Relaxed fit, wide hems and a 2.5 cm ribbed neckline; pre-shrunk, softened and lightly stonewashed.",
    details: "A estampa frontal traz a imagem de uma hidromedusa no fundo do oceano abissal, simbolizando o mar como metáfora. Nas costas, a T-shirt leva o título do álbum “Um Mar Pra Cada Um”. Feita em meia malha 30 fios, tem modelagem ampla, bainhas largas e gola canelada de 2,5 cm. A peça é pré-encolhida, amaciada e passa por processo de brush, que dá um efeito levemente estonado. Composição: 100% algodão. Arte: Guile Farias. Foto da hidromedusa: Álvaro Migotto. Os modelos vestem G; altura homem 1,85 m e mulher 1,70 m.",
    installmentCount: 6,
    installmentAmount: "R$ 33,00",
    price: "R$ 198,00",
    sellPrice: "198.00",
    pixPrice: "R$ 188,10",
    colors: [
      { id: "preto", label: "Preto", swatchColor: "#000000", promptColor: "black" },
    ],
    sizes: ["P", "M", "G", "GG", "XGG"],
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "cropped-barra-cura",
    name: "CROPPED BARRA CURA",
    productUrl: "https://www.ciclodaarte.com.br/cropped-barra-cura",
    sku: "1012024562589509161",
    catalogProductCode: "400373670",
    imageUrl: "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400373670/42a3595bf70d4db5afdba0130eb5903e-ok1houpnnf.jpg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400373670/22a885222386435baa87b60a9baa9355-a1ckwf2tja.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400373670/7f5508ead4f647958a948e1b461b3e6f-8q2aiqsnka.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400373670/1730a6c345974ceaab3ec5581d38c5fe-ahksdhlwl3.jpg",
    ],
    garment: "top",
    collectionLabel: "COLLAB GILSONS + CÏCLOARTE - MERCH OFICIAL DO ÁLBUM “EU VEJO LUZ”",
    genderLabel: "Unissex",
    description: "Cropped cotton T-shirt with a slightly square, relaxed fit and a waist-length hem. Made from pre-shrunk and softened 30-count jersey with a 2.5 cm ribbed neckline and wide hems.",
    details: "Tem música que vira abrigo. O Cropped Barra Cura nasce desse encontro entre som, memória e uma peça que entra no look sem precisar explicar muito. Cropped com modelagem levemente quadrada e comprimento na altura da cintura. Confeccionado em meia malha 30 fios, tem modelagem square ampla, gola canelada com 2,5 cm e bainhas largas. A peça é pré-encolhida e amaciada. Composição: 100% algodão.",
    installmentCount: 6,
    installmentAmount: "R$ 24,16",
    price: "R$ 145,00",
    sellPrice: "145.00",
    pixPrice: "R$ 137,75",
    colors: [
      { id: "roti", label: "Roti", swatchColor: "#C6A84B", promptColor: "Roti, a warm golden tan" },
    ],
    sizes: ["PP", "P", "M", "G", "GG", "XGG"],
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "t-shirt-barra-eu-vejo-luz",
    name: "T- SHIRT BARRA EU VEJO LUZ",
    productUrl: "https://www.ciclodaarte.com.br/t-shirt-barra-eu-vejo-luz",
    sku: "1012024562589509142",
    catalogProductCode: "400368898",
    imageUrl: "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/6fe722b800cb417eb07b75b6d4d4a940-ff74nxgspz.jpg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/a96914fc7802445aa5dbeab2d72af989-r8u669qy5v.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/7f3f61aaffd444f6b595598897e55f41-a4tf6fsvn6.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/e24f30874ba341fd818a3a455bde9b2e-yw7i5ktgre.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/baef524dc9fc40c3b5c9093ebec28323-iqg34whweb.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/0c9bcbb4d95a46128ad5d51d86a59d68-gjfevne4gf.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/137860c3c7dd4a229c84b65901109ed7-plv1u5jdc6.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/4c8c6e8a1fad4a008cc1e10dac7d1c9f-6gf23hsre7.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/3ae14c6b064e43f9ac5a7deaaa48bb5a-ccg7k33ela.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/eeb00ba1631b4475b18eb8f9fc8aa887-d3c48dy37h.jpg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/400368898/aa33e197331f46e5b4b8e5fff68da4c2-9aq3jtsjdi.jpg",
    ],
    garment: "top",
    collectionLabel: "COLLAB GILSONS + CÏCLOARTE - MERCH OFICIAL DO ÁLBUM “EU VEJO LUZ”",
    genderLabel: "Unissex",
    description: "Relaxed square-fit cotton T-shirt with wide hems and a 2.5 cm ribbed neckline. Pre-shrunk and softened for a comfortable drape.",
    details: "Algumas frases parecem ganhar outro sentido quando saem da música e entram na rua. A T-Shirt Barra Eu Vejo Luz carrega essa ideia em uma peça ampla e fácil de viver. Feita em meia malha 30 fios, tem modelagem square ampla, bainhas largas e gola canelada de 2,5 cm. A peça é pré-encolhida e amaciada. Composição: 100% algodão.",
    installmentCount: 6,
    installmentAmount: "R$ 26,50",
    price: "R$ 159,00",
    sellPrice: "159.00",
    pixPrice: "R$ 151,05",
    colors: [
      { id: "preto", label: "Preto", swatchColor: "#000000", promptColor: "black" },
      { id: "bordeaux", label: "Bordeaux", swatchColor: "#5C0120", promptColor: "deep bordeaux" },
      { id: "indian-khaki", label: "Indian Khaki", swatchColor: "#C3B091", promptColor: "Indian khaki, a light warm beige" },
    ],
    sizes: ["PP", "P", "M", "G", "GG", "XGG"],
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
  {
    id: "t-shirt-ddga-a-lona-que-habito",
    name: "T-SHIRT DDGA A LONA QUE HABITO",
    productUrl: "https://www.ciclodaarte.com.br/t-shirt-ddga-a-lona-que-habito",
    sku: "1012024562589508944",
    catalogProductCode: "387117219",
    imageUrl: "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/whatsapp-image-2026-01-02-at-14-35-51-p0cl5ulrpl.jpeg",
    imageUrls: [
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro259427-kg8cj94jil.jpeg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro259534-jedmxa9mw2.jpeg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro259552-cnee3mddek.jpeg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro250970-yyqp3fs979.jpeg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro250975-gwv48dh47v.jpeg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro250280-t0wcnt55mo.jpeg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro250260-cniqf2b1p2.jpeg",
      "https://cdn.awsli.com.br/2500x2500/2557/2557100/produto/387117219/ciclo_dezembro250276-ew0qduojgd.jpeg",
    ],
    garment: "top",
    collectionLabel: "COLLAB CIRCO VOADOR + CÏCLOARTE",
    genderLabel: "Unissex",
    description: "Cotton T-shirt printed with “A Lona Que Habito”, in a relaxed, slightly elongated fit with sleeves above the elbow and a 2.5 cm ribbed collar. Pre-shrunk and softened.",
    details: "“A lona que habito” pode ser palco, casa, corpo ou tudo isso junto. A camiseta leva a frase para as ruas sem tentar explicar o que cada pessoa deve sentir. Confeccionada em meia malha 30 fios, tem modelagem ampla e levemente alongada, mangas um pouco acima do cotovelo e gola canelada de 2,5 cm. A peça é amaciada e pré-encolhida. Composição: 100% algodão. A modelo tem 1,65 m e veste P; o modelo tem 1,87 m e veste GG.",
    installmentCount: 6,
    installmentAmount: "R$ 29,66",
    price: "R$ 178,00",
    sellPrice: "178.00",
    pixPrice: "R$ 169,10",
    colors: [
      { id: "preto", label: "Preto", swatchColor: "#000000", promptColor: "black" },
      { id: "branco", label: "Branco", swatchColor: "#FFFFFF", promptColor: "white" },
    ],
    sizes: ["P", "M", "G", "GG", "XGG"],
    sizeChart: SPELHO_SIZE_CHART,
    size: "M",
  },
];

export function SpelhoStorefront() {
  const [activeProduct, setActiveProduct] = useState<TryOnProduct | null>(null);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [detailsProduct, setDetailsProduct] = useState<SpelhoProduct | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDetailImage, setSelectedDetailImage] = useState(0);
  const [detailGalleryPage, setDetailGalleryPage] = useState(0);
  const [selectedDetailSize, setSelectedDetailSize] = useState("M");
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [selectedColors, setSelectedColors] = useState<Record<string, string>>({});

  function getSelectedColor(product: SpelhoProduct, colorId?: string) {
    const selectedId = colorId ?? selectedColors[product.id];
    return product.colors.find((color) => color.id === selectedId) ?? product.colors[0];
  }

  function selectColor(product: SpelhoProduct, colorId: string) {
    setSelectedColors((current) => ({ ...current, [product.id]: colorId }));
    setSelectedDetailImage(0);
    setDetailGalleryPage(0);
  }

  function startTryOn(product: SpelhoProduct, colorId?: string) {
    const color = getSelectedColor(product, colorId);
    setActiveProduct({
      ...product,
      imageUrl: color.imageUrl ?? product.imageUrl,
      imageUrls: color.imageUrls ?? product.imageUrls,
      description: [`Color: ${color.promptColor}.`, product.description].filter(Boolean).join(" "),
    });
    setTryOnOpen(true);
  }

  function openProductDetails(product: SpelhoProduct) {
    setDetailsProduct(product);
    setSelectedDetailImage(0);
    setDetailGalleryPage(0);
    setSelectedDetailSize(product.size);
    setShowSizeChart(false);
    setDetailsOpen(true);
  }

  function tryOnFromDetails() {
    if (!detailsProduct) return;
    const productForTryOn = { ...detailsProduct, size: selectedDetailSize };
    setDetailsOpen(false);
    startTryOn(productForTryOn);
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
            const selectedColor = getSelectedColor(product);
            const mainImage = selectedColor.imageUrl ?? product.imageUrl;
            const alternateImages = selectedColor.imageUrls ?? (selectedColor.imageUrl ? [] : product.imageUrls);
            const alternateImage = alternateImages?.find((url) => url !== mainImage);
            return (
              <article
                key={product.id}
                className="listagem-item group relative min-w-0 border-2 border-transparent bg-white p-2.5 transition-colors duration-200 hover:border-black"
              >
                <div className="produto-sobrepor" aria-hidden="true" />
                <div className="relative aspect-[7/10] overflow-hidden bg-[#f4f3f0]">
                  <img src={mainImage} alt={`${product.name}, ${selectedColor.label}`} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.025] group-hover:opacity-0" />
                  {alternateImage ? (
                    <img
                      src={alternateImage}
                      alt={`${product.name}, ${selectedColor.label}, outra vista`}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = product.imageUrl;
                      }}
                      className="absolute inset-0 size-full object-cover opacity-0 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100"
                    />
                  ) : null}
                </div>
                <div className="info-produto">
                  <div className="cn-cores relative z-20">
                    <ul>
                      {product.colors.map((color) => (
                        <li key={color.id}>
                          <button
                            type="button"
                            aria-label={`Selecionar cor ${color.label}`}
                            aria-pressed={selectedColor.id === color.id}
                            title={color.label}
                            onClick={() => selectColor(product, color.id)}
                            className={`size-full ${selectedColor.id === color.id ? "ring-1 ring-inset ring-black" : "opacity-70 hover:opacity-100"}`}
                            style={{ background: color.swatchColor }}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="nome-produto cor-secundaria">
                    {product.name}
                  </div>
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
                <button
                  type="button"
                  aria-label={`Ver detalhes de ${product.name}`}
                  onClick={() => openProductDetails(product)}
                  className="absolute inset-0 z-10 cursor-pointer"
                />
                <Button type="button" onClick={() => startTryOn(product)} className="relative z-20 mt-3 h-10 w-full rounded-none bg-black px-2 text-[9px] font-medium uppercase tracking-[0.08em] text-white shadow-none hover:bg-black/80 sm:h-11 sm:text-[10px] sm:tracking-[0.12em]">
                  <Sparkles className="size-3.5 shrink-0 sm:size-4" /> Experimentar
                </Button>
              </article>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[10px] leading-5 text-black/45">Consulte a tabela de medidas para confirmar a numeração.</p>
      </section>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-none gap-0 overflow-y-auto rounded-none border-0 bg-white p-0 text-black sm:h-[min(88dvh,820px)] sm:max-h-[88dvh] sm:max-w-6xl sm:overflow-hidden sm:border sm:border-black/10">
          {detailsProduct ? (() => {
            const selectedColor = getSelectedColor(detailsProduct);
            const selectedImageUrl = selectedColor.imageUrl ?? detailsProduct.imageUrl;
            const selectedImageUrls = selectedColor.imageUrls ?? (selectedColor.imageUrl ? [] : detailsProduct.imageUrls ?? []);
            const gallery = [selectedImageUrl, ...selectedImageUrls]
              .filter((url, index, all) => all.indexOf(url) === index);
            const imageIndex = Math.min(selectedDetailImage, gallery.length - 1);
            const galleryPageCount = Math.ceil(gallery.length / PRODUCT_GALLERY_PAGE_SIZE);
            const visibleGallery = gallery.slice(
              detailGalleryPage * PRODUCT_GALLERY_PAGE_SIZE,
              (detailGalleryPage + 1) * PRODUCT_GALLERY_PAGE_SIZE,
            );
            const renderThumbnail = (url: string) => {
              const index = gallery.indexOf(url);
              return (
                <button
                  key={url}
                  type="button"
                  aria-label={`Ver imagem ${index + 1}`}
                  aria-pressed={imageIndex === index}
                  onClick={() => {
                    setSelectedDetailImage(index);
                    setDetailGalleryPage(Math.floor(index / PRODUCT_GALLERY_PAGE_SIZE));
                  }}
                  className={`size-9 shrink-0 overflow-hidden border ${imageIndex === index ? "border-black" : "border-black/20 opacity-70 hover:opacity-100"}`}
                >
                  <img src={url} alt="" className="size-full object-cover" />
                </button>
              );
            };
            return (
              <div className="grid min-h-full grid-cols-1 sm:h-full sm:min-h-0 sm:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <section className="flex min-h-[42dvh] flex-col gap-2 bg-white p-3 sm:min-h-0 sm:flex-row sm:gap-3 sm:p-4">
                  <div className="order-2 flex min-w-0 flex-col items-center justify-center gap-2 sm:order-1 sm:w-12 sm:shrink-0">
                    <div className="grid w-full grid-cols-3 justify-items-center gap-1 sm:hidden">
                      {visibleGallery.map(renderThumbnail)}
                    </div>
                    <div className="hidden items-center justify-center gap-1 sm:flex sm:flex-col">
                      {galleryPageCount > 1 ? (
                        <button
                          type="button"
                          aria-label="Fotos anteriores"
                          disabled={detailGalleryPage === 0}
                          onClick={() => setDetailGalleryPage((page) => Math.max(0, page - 1))}
                          className="grid size-7 shrink-0 place-items-center border border-black/15 transition hover:bg-black/5 disabled:opacity-35"
                        ><ChevronLeft className="size-4 rotate-90" /></button>
                      ) : null}
                      {visibleGallery.map(renderThumbnail)}
                      {galleryPageCount > 1 ? (
                        <button
                          type="button"
                          aria-label="Próximas fotos"
                          disabled={detailGalleryPage >= galleryPageCount - 1}
                          onClick={() => setDetailGalleryPage((page) => Math.min(galleryPageCount - 1, page + 1))}
                          className="grid size-7 shrink-0 place-items-center border border-black/15 transition hover:bg-black/5 disabled:opacity-35"
                        ><ChevronRight className="size-4 -rotate-90" /></button>
                      ) : null}
                      {galleryPageCount > 1 ? <span className="text-[10px] tabular-nums text-black/50">{detailGalleryPage + 1}/{galleryPageCount}</span> : null}
                    </div>
                    {galleryPageCount > 1 ? (
                      <div className="flex items-center gap-2 sm:hidden">
                        <button type="button" aria-label="Fotos anteriores" disabled={detailGalleryPage === 0} onClick={() => setDetailGalleryPage((page) => Math.max(0, page - 1))} className="grid size-7 place-items-center border border-black/15 disabled:opacity-35"><ChevronLeft className="size-4" /></button>
                        <span className="text-[10px] tabular-nums text-black/50">{detailGalleryPage + 1}/{galleryPageCount}</span>
                        <button type="button" aria-label="Próximas fotos" disabled={detailGalleryPage >= galleryPageCount - 1} onClick={() => setDetailGalleryPage((page) => Math.min(galleryPageCount - 1, page + 1))} className="grid size-7 place-items-center border border-black/15 disabled:opacity-35"><ChevronRight className="size-4" /></button>
                      </div>
                    ) : null}
                  </div>
                  <div
                    className="spelho-product-detail-image relative order-1 min-h-0 flex-1 overflow-hidden bg-transparent sm:order-2"
                    onMouseMove={(event) => {
                      const bounds = event.currentTarget.getBoundingClientRect();
                      if (!bounds.width || !bounds.height) return;
                      const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                      const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                      event.currentTarget.style.setProperty("--zoom-x", `${x}%`);
                      event.currentTarget.style.setProperty("--zoom-y", `${y}%`);
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.setProperty("--zoom-x", "50%");
                      event.currentTarget.style.setProperty("--zoom-y", "50%");
                    }}
                  >
                    <img src={gallery[imageIndex]} alt={`${detailsProduct.name}, ${selectedColor.label}, imagem ${imageIndex + 1}`} className="absolute inset-0 size-full object-contain transition-transform duration-500 sm:object-contain" />
                    {gallery.length > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label="Imagem anterior"
                          onClick={() => {
                            const nextIndex = (imageIndex - 1 + gallery.length) % gallery.length;
                            setSelectedDetailImage(nextIndex);
                            setDetailGalleryPage(Math.floor(nextIndex / PRODUCT_GALLERY_PAGE_SIZE));
                          }}
                          className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-sm sm:hidden"
                        ><ChevronLeft className="size-5" /></button>
                        <button
                          type="button"
                          aria-label="Próxima imagem"
                          onClick={() => {
                            const nextIndex = (imageIndex + 1) % gallery.length;
                            setSelectedDetailImage(nextIndex);
                            setDetailGalleryPage(Math.floor(nextIndex / PRODUCT_GALLERY_PAGE_SIZE));
                          }}
                          className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-sm sm:hidden"
                        ><ChevronRight className="size-5" /></button>
                      </>
                    ) : null}
                  </div>
                </section>

                <section className="relative flex min-h-0 flex-col overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-5 sm:pt-4 lg:px-7">
                  <p className="pr-10 text-[10px] uppercase tracking-wide text-black/60">Início » Collabs » <span className="font-bold text-black">{detailsProduct.name}</span></p>
                  <DialogTitle className="mt-2 text-center text-2xl font-bold leading-tight sm:text-3xl">{detailsProduct.name}</DialogTitle>
                  <DialogDescription className="mt-2 text-[10px] font-semibold uppercase leading-relaxed text-black">
                    CÓDIGO: {detailsProduct.sku}
                  </DialogDescription>
                  <div className="mt-4 space-y-2 text-[11px] uppercase leading-[1.4] text-black sm:mt-4 sm:text-[11px]">
                    <p>{detailsProduct.collectionLabel}</p>
                    <p>{detailsProduct.details}</p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {detailsProduct.genderLabel ? (
                      <div>
                        <h3 className="text-sm font-bold uppercase">Gênero</h3>
                        <span className="mt-1 inline-flex bg-black px-3 py-1 text-[10px] font-bold uppercase text-white">{detailsProduct.genderLabel}</span>
                      </div>
                    ) : null}
                    <div>
                      <h3 className="text-sm font-bold uppercase">Cor: {selectedColor.label}</h3>
                      <div className="mt-1 flex gap-2">
                        {detailsProduct.colors.map((color) => (
                          <button
                            key={color.id}
                            type="button"
                            aria-label={`Selecionar cor ${color.label}`}
                            aria-pressed={selectedColor.id === color.id}
                            title={color.label}
                            onClick={() => selectColor(detailsProduct, color.id)}
                            className={`size-7 border ${selectedColor.id === color.id ? "border-black ring-1 ring-black ring-offset-1" : "border-black/20 opacity-70 hover:opacity-100"}`}
                            style={{ backgroundColor: color.swatchColor }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase">Tamanho</h3>
                      <div className="mt-2 flex gap-2">
                        {detailsProduct.sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            aria-pressed={selectedDetailSize === size}
                            onClick={() => setSelectedDetailSize(size)}
                            className={`min-w-9 border px-2 py-1.5 text-xs font-bold transition-colors ${selectedDetailSize === size ? "border-black bg-black text-white" : "border-black bg-white text-black hover:bg-black/5"}`}
                          >{size}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase">{detailsProduct.installmentCount}x de {detailsProduct.installmentAmount}</p>
                      <p className="text-xl font-bold uppercase">{detailsProduct.price}</p>
                      <p className="text-[10px] uppercase">ou <strong>{detailsProduct.pixPrice}</strong> via Pix</p>
                    </div>
                    {detailsProduct.garment !== "headwear" ? (
                      <button type="button" onClick={() => setShowSizeChart((show) => !show)} className="inline-flex items-center gap-2 text-sm font-bold uppercase underline underline-offset-4">
                        <Ruler className="size-4" /> Tabela de medidas
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                    <Button asChild variant="outline" className="min-h-10 rounded-none border-black text-xs font-bold uppercase tracking-wide text-black shadow-none hover:bg-black hover:text-white">
                      <a href={detailsProduct.productUrl} target="_blank" rel="noreferrer">Comprar</a>
                    </Button>
                    <Button type="button" onClick={tryOnFromDetails} className="min-h-10 rounded-none bg-black text-xs font-bold uppercase tracking-wide text-white shadow-none hover:bg-black/80">
                      <Sparkles className="size-4" /> Experimentar
                    </Button>
                  </div>
                </section>
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showSizeChart} onOpenChange={setShowSizeChart}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl gap-3 overflow-y-auto border-0 bg-white p-4 text-black sm:p-6">
          <DialogTitle className="pr-8 text-base font-bold uppercase">Tabela de medidas</DialogTitle>
          <img src={SIZE_CHART_IMAGE} alt="Tabela de medidas da camiseta" className="mx-auto max-h-[78dvh] w-auto max-w-full object-contain" />
        </DialogContent>
      </Dialog>

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
