// Ilustrações do tutorial do provador virtual e a silhueta-guia sobre a câmera.
// Todas usam currentColor para seguir o tema.

/** "upper": da cabeça ao quadril (peças de cima). "full": corpo inteiro (calças, calçados). */
export type TryOnFraming = "upper" | "full";

interface IllustrationProps {
  className?: string;
}

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Person({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} {...line}>
      <circle cx="0" cy="0" r="9" />
      <path d="M-12 16 Q0 11 12 16 L10 54 L-10 54 Z" />
      <path d="M-12 18 L-19 50 M12 18 L19 50" />
      <path d="M-6 54 L-7 88 M6 54 L7 88" strokeWidth={4} />
    </g>
  );
}

export function PhoneStandIllustration({ className }: IllustrationProps) {
  return (
    <img src="/guiadaprova/ChatGPT%20Image%202%20de%20out.%20de%202026,%2013_07_15.png" alt="" aria-hidden="true" className={className} />
  );
}

export function DistanceIllustration({ className }: IllustrationProps & { framing: TryOnFraming }) {
  return (
    <img src="/guiadaprova/ChatGPT%20Image%202%20de%20out.%20de%202026,%2013_09_08.png" alt="" aria-hidden="true" className={className} />
  );
}

export function LightIllustration({ className }: IllustrationProps) {
  return (
    <img src="/guiadaprova/ChatGPT%20Image%202%20de%20out.%20de%202026,%2013_09_50.png" alt="" aria-hidden="true" className={className} />
  );
}

// Silhueta de frente com braços levemente afastados, desenhada num espaço de 100x200.
const BODY_PATH =
  "M45 33 L45 39 C38 40 31 41 27 45 C23 50 22 58 21 68 L17 106 C17 110 23 111 24 107 L28 72 L31 64 " +
  "L32 92 C32 100 31 106 32 112 L35 186 C35 190 28 191 28 194 L47 194 L48 186 L50 120 L52 186 L53 194 " +
  "L72 194 C72 191 65 190 65 186 L68 112 C69 106 68 100 68 92 L69 64 L72 72 L76 107 C77 111 83 110 83 106 " +
  "L79 68 C78 58 77 50 73 45 C69 41 62 40 55 39 L55 33";

// Posiciona a silhueta num quadro 9:16 (90x160): corpo inteiro ou da cabeça às coxas.
const FRAMING_TRANSFORM: Record<TryOnFraming, string> = {
  full: "translate(6.5 2.6) scale(0.77)",
  upper: "translate(-12.5 4) scale(1.15)",
};

export function BodyGuide({ className, framing }: IllustrationProps & { framing: TryOnFraming }) {
  return (
    <svg
      viewBox="0 0 90 160"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={className}
    >
      <g
        transform={FRAMING_TRANSFORM[framing]}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeDasharray="7 6"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        <ellipse cx="50" cy="20" rx="11" ry="13" vectorEffect="non-scaling-stroke" />
        <path d={BODY_PATH} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
