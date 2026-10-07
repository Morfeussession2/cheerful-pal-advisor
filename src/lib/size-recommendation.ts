// Recomendação de tamanho: altura + peso definem o tamanho e a câmera refina.
//
// É uma ESTIMATIVA. As constantes vêm de médias antropométricas de homens
// adultos (levantamento ANSUR II) e precisam ser calibradas com pessoas de
// medidas conhecidas antes de ir para produção. Vale só para grade masculina.

import type { GarmentKind } from "@/lib/try-on-prompt";

export interface BodyProfile {
  heightCm: number;
  weightKg: number;
  /** Medida informada pela pessoa; prevalece sobre a leitura da câmera. */
  shoulderWidthCm?: number | undefined;
  /** Medida informada pela pessoa; prevalece sobre a estimativa por altura/peso. */
  waistCm?: number | undefined;
}

/** Medidas tiradas pela câmera (veja body-measure.ts). */
export interface CameraMeasurements {
  /** Largura dos ombros, em cm. */
  shoulderWidthCm: number;
  /** Quadros aproveitados na medição. */
  samples: number;
}

/** Uma linha da tabela de medidas do CORPO; os tamanhos vão do menor para o maior. */
export interface SizeChartRow {
  size: string;
  /** Maior tórax (cm) que o tamanho veste. */
  chestMaxCm?: number;
  /** Maior cintura (cm) que o tamanho veste. */
  waistMaxCm: number;
  /** Maior largura de ombros (cm) que o tamanho veste, quando houver. */
  shoulderMaxCm?: number;
}

export interface SizeRecommendation {
  size: string;
  /** Tamanho vizinho quando a pessoa está perto do limite entre dois. */
  alternative?: { size: string; when: "justo" | "folgado" } | undefined;
  /** O que definiu o tamanho. */
  basis: "torax" | "cintura" | "ombros";
  /** A câmera mediu a pessoa (mesmo que não tenha mudado o tamanho). */
  usedCamera: boolean;
  shoulderSource: "manual" | "camera" | "unavailable";
  waistSource: "manual" | "height-weight";
  /** Estimativas usadas, para diagnóstico e calibração. */
  estimates: { chestCm?: number | undefined; waistCm: number; shoulderCm?: number | undefined };
}

// Regressão por altura e peso: para o mesmo peso, quem é mais alto tem tórax e
// cintura menores.
function estimateChest({ heightCm, weightKg }: BodyProfile) {
  return 99.9 + 0.584 * weightKg - 0.25 * heightCm;
}

function estimateWaist({ heightCm, weightKg }: BodyProfile) {
  return 104.1 + 0.796 * weightKg - 0.445 * heightCm;
}

// Ombros "claramente largos": acima de 25,5% da altura (média masculina 23,7%,
// +1,5 desvio-padrão). O limiar é alto de propósito: a medida pela câmera tem
// erro de 2–3 cm, e os modelos do catálogo (que vestem M) ficam em 24–24,5%.
const BROAD_SHOULDERS_TO_HEIGHT = 0.255;
// A menos disso do limite da tabela, sugere também o tamanho vizinho.
const BORDERLINE_CM = 1.5;

export function isValidProfile(profile: Partial<BodyProfile> | null): profile is BodyProfile {
  return (
    !!profile &&
    typeof profile.heightCm === "number" &&
    typeof profile.weightKg === "number" &&
    profile.heightCm >= 140 &&
    profile.heightCm <= 215 &&
    profile.weightKg >= 40 &&
    profile.weightKg <= 180 &&
    (profile.shoulderWidthCm === undefined ||
      (Number.isFinite(profile.shoulderWidthCm) &&
        profile.shoulderWidthCm >= 20 &&
        profile.shoulderWidthCm <= 80)) &&
    (profile.waistCm === undefined ||
      (Number.isFinite(profile.waistCm) && profile.waistCm >= 40 && profile.waistCm <= 200))
  );
}

// Menor tamanho que veste a medida; quem passa do maior fica no maior.
type ChartMeasure = "chestMaxCm" | "waistMaxCm" | "shoulderMaxCm";

function sizeIndexFor(chart: SizeChartRow[], key: ChartMeasure, valueCm: number) {
  const index = chart.findIndex((row) => row[key] !== undefined && valueCm <= row[key]!);
  return index === -1 ? chart.length - 1 : index;
}

// Perto do limite de cima, quem gosta de folga pode subir um tamanho; logo
// acima do limite de baixo, quem gosta de justo pode descer um.
function withAlternative(
  chart: SizeChartRow[],
  index: number,
  key: ChartMeasure,
  valueCm: number,
): Pick<SizeRecommendation, "size" | "alternative"> {
  const row = chart[index]!;
  const smaller = chart[index - 1];
  const larger = chart[index + 1];
  const rowLimit = row[key];
  const smallerLimit = smaller?.[key];
  if (rowLimit === undefined) return { size: row.size };
  if (larger && rowLimit - valueCm < BORDERLINE_CM) {
    return { size: row.size, alternative: { size: larger.size, when: "folgado" } };
  }
  if (smaller && smallerLimit !== undefined && valueCm - smallerLimit < BORDERLINE_CM) {
    return { size: row.size, alternative: { size: smaller.size, when: "justo" } };
  }
  return { size: row.size };
}

export function recommendSize(
  garment: GarmentKind,
  chart: readonly SizeChartRow[],
  profile: BodyProfile,
  camera?: CameraMeasurements | null,
): SizeRecommendation | null {
  // Calçados usam numeração própria, que altura e peso não estimam.
  if (garment === "shoes" || chart.length === 0) return null;

  const rows = [...chart];
  const waistCm = profile.waistCm ?? estimateWaist(profile);
  const shoulderCm = profile.shoulderWidthCm ?? camera?.shoulderWidthCm;
  const shoulderSource =
    profile.shoulderWidthCm !== undefined
      ? "manual"
      : shoulderCm !== undefined
        ? "camera"
        : "unavailable";
  const waistSource = profile.waistCm !== undefined ? "manual" : "height-weight";
  const usedCamera = shoulderSource === "camera";
  const waistIndex = sizeIndexFor(rows, "waistMaxCm", waistCm);

  // Grades da Spelho usam limites de ombro e cintura; nesse caso não usamos
  // a estimativa de tórax nem a regra genérica de ombros largos.
  if (rows.every((row) => row.shoulderMaxCm !== undefined)) {
    const shoulderIndex =
      shoulderCm === undefined ? -1 : sizeIndexFor(rows, "shoulderMaxCm", shoulderCm);
    const index = Math.max(waistIndex, shoulderIndex);
    const basis = shoulderIndex >= waistIndex && shoulderCm !== undefined ? "ombros" : "cintura";
    const measure = basis === "ombros" ? shoulderCm! : waistCm;
    return {
      ...withAlternative(rows, index, basis === "ombros" ? "shoulderMaxCm" : "waistMaxCm", measure),
      basis,
      usedCamera,
      shoulderSource,
      waistSource,
      estimates: { waistCm, shoulderCm },
    };
  }

  const chestCm = estimateChest(profile);
  const estimates = { chestCm, waistCm, shoulderCm };

  // Peças de baixo: quem manda é a cintura.
  if (garment === "bottom") {
    return {
      ...withAlternative(rows, waistIndex, "waistMaxCm", waistCm),
      basis: "cintura",
      usedCamera,
      shoulderSource,
      waistSource,
      estimates,
    };
  }

  // Peças de cima: precisam vestir o tórax e fechar na cintura.
  const chestIndex = sizeIndexFor(rows, "chestMaxCm", chestCm);
  const index = Math.max(chestIndex, waistIndex);
  const basis = waistIndex > chestIndex ? "cintura" : "torax";

  // Ombros claramente largos para a altura pedem um tamanho acima.
  if (
    shoulderCm !== undefined &&
    shoulderCm > profile.heightCm * BROAD_SHOULDERS_TO_HEIGHT &&
    index < rows.length - 1
  ) {
    return {
      size: rows[index + 1]!.size,
      basis: "ombros",
      usedCamera,
      shoulderSource,
      waistSource,
      estimates,
    };
  }

  return {
    ...withAlternative(
      rows,
      index,
      basis === "cintura" ? "waistMaxCm" : "chestMaxCm",
      basis === "cintura" ? waistCm : chestCm,
    ),
    basis,
    usedCamera,
    shoulderSource,
    waistSource,
    estimates,
  };
}
