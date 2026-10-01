// Prompt do Lucy VTON 3.5, seguindo o guia da Decart: uma única ação
// ("Substitute <região> with ..."), descrição fiel da peça da imagem de
// referência (cor, tecido, modelagem, se está aberta/fechada, detalhes visíveis)
// e nada de pedidos fora da roupa. Limite do modelo: ~750 caracteres em inglês.
//
// Tamanho/caimento não entra no prompt: o modelo ajusta a peça ao corpo da pessoa
// e ignora instruções como "two sizes too big" (testado no Lucy 2.1 e no VTON 3.5).

export type GarmentKind = "top" | "bottom" | "shoes" | "dress";

const REGION: Record<GarmentKind, string> = {
  top: "the upper body garment",
  bottom: "the lower body garment",
  shoes: "the footwear",
  dress: "the person's current dress",
};

const FALLBACK_DESCRIPTION: Record<GarmentKind, string> = {
  top: "the top from the reference image",
  bottom: "the bottoms from the reference image",
  shoes: "the shoes from the reference image",
  dress: "the dress from the reference image",
};

export interface TryOnPromptInput {
  garment: GarmentKind;
  /** Descrição em inglês da peça da foto de referência (cor, tecido, modelagem, detalhes). */
  description?: string | undefined;
}

export function buildTryOnPrompt({ garment, description }: TryOnPromptInput) {
  return `Substitute ${REGION[garment]} with ${description ?? FALLBACK_DESCRIPTION[garment]}.`;
}
