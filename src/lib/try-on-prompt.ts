// Prompt do Lucy 2.1 VTON. O modelo segue melhor instruções concretas: o que
// trocar, como é a peça da imagem de referência (cor, tecido, modelagem,
// detalhes — recomendação do Decart) e o que deve continuar igual.
// Os prompts ficam em inglês porque é o idioma em que o modelo foi treinado.

export type GarmentKind = "top" | "bottom" | "shoes";

const TARGET: Record<GarmentKind, string> = {
  top: "the person's current top",
  bottom: "the person's current pants or shorts",
  shoes: "the person's current shoes",
};

const GARMENT_NOUN: Record<GarmentKind, string> = {
  top: "the outfit",
  bottom: "the bottoms",
  shoes: "the footwear",
};

// Como o caimento aparece em cada região do corpo, do mais apertado ao mais largo.
const FIT_DETAILS: Record<Exclude<GarmentKind, "shoes">, [string, string, string, string]> = {
  top: [
    "stretched across the chest and shoulders, with sleeves and hem visibly too short",
    "close to the body, with slightly shorter sleeves",
    "with extra room in the body and sleeves",
    "with dropped shoulders, sleeves covering part of the hands and a longer hem",
  ],
  bottom: [
    "tight at the waist and thighs, with a visibly shorter length",
    "close-fitting at the waist and thighs",
    "with extra room at the waist and legs",
    "loose at the waist, with wider and longer legs",
  ],
};

// Simulação aproximada: o modelo não mede o corpo, só desenha o caimento descrito.
function fitSentence(garment: GarmentKind, sizeOffset: number) {
  if (garment === "shoes") return "";
  const [tighter, snug, loose, looser] = FIT_DETAILS[garment];
  if (sizeOffset <= -2)
    return `The garment is two or more sizes smaller than the person's reference size: very tight, ${tighter}.`;
  if (sizeOffset === -1)
    return `The garment is one size smaller than the person's reference size: snug, ${snug}.`;
  if (sizeOffset === 1)
    return `The garment is one size larger than this person's measurement-based recommended size: a relaxed fit, ${loose}.`;
  if (sizeOffset >= 2)
    return `The garment is two or more sizes too big for this person: oversized and baggy, ${looser}.`;
  return "The garment fits this person true to size, with its natural cut.";
}

export interface TryOnPromptInput {
  garment: GarmentKind;
  /** Descrição em inglês da peça da foto de referência (cor, tecido, modelagem, detalhes). */
  description?: string | undefined;
  /** Diferença entre o tamanho experimentado e o tamanho de referência da pessoa (ex.: G vs M = 1). */
  sizeOffset?: number | undefined;
}

export function buildTryOnPrompt({ garment, description, sizeOffset }: TryOnPromptInput) {
  return [
    `Substitute ${TARGET[garment]} with ${GARMENT_NOUN[garment]} from the reference image${description ? `: ${description}` : ""}.`,
    "Match the exact color, material, texture and construction details of the reference garment. Follow the size-fit instruction for its fit.",
    sizeOffset === undefined ? "" : fitSentence(garment, sizeOffset),
    "Keep the person's face, hair, body shape, pose, other clothes and the background unchanged.",
  ]
    .filter(Boolean)
    .join(" ");
}
