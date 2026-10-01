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
    <svg viewBox="0 0 200 140" aria-hidden="true" className={className}>
      <line x1="12" y1="120" x2="188" y2="120" {...line} />
      {/* livros servindo de apoio */}
      <rect x="106" y="100" width="60" height="20" rx="2" {...line} />
      <rect x="112" y="82" width="50" height="18" rx="2" {...line} />
      <rect x="108" y="66" width="56" height="16" rx="2" {...line} />
      {/* celular em pé, encostado nos livros */}
      <g transform="rotate(12 91 120)">
        <rect x="86" y="40" width="10" height="80" rx="3" {...line} strokeWidth={2.5} />
      </g>
      <circle cx="99" cy="49" r="2" fill="currentColor" />
      {/* campo de visão da câmera frontal */}
      <path d="M96 50 L18 24 M96 50 L18 104" {...line} strokeDasharray="4 5" opacity={0.55} />
    </svg>
  );
}

export function DistanceIllustration({
  className,
  framing,
}: IllustrationProps & { framing: TryOnFraming }) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden="true" className={className}>
      <line x1="8" y1="124" x2="192" y2="124" {...line} />
      <rect x="14" y="100" width="30" height="24" rx="2" {...line} />
      <rect x="22" y="70" width="14" height="28" rx="3" {...line} />
      <circle cx="29" cy="75" r="1.5" fill="currentColor" />
      <Person x={160} y={34} />
      {/* área que precisa aparecer na câmera */}
      <rect
        x="134"
        y="20"
        width="52"
        height={framing === "upper" ? 74 : 108}
        {...line}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={0.6}
      />
      <path d="M52 116 L128 116 M58 111 L52 116 L58 121 M122 111 L128 116 L122 121" {...line} />
      <text x="90" y="107" textAnchor="middle" fontSize="11" fill="currentColor">
        {framing === "upper" ? "1 a 1,5 m" : "2 a 2,5 m"}
      </text>
    </svg>
  );
}

export function LightIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 140" aria-hidden="true" className={className}>
      {/* fundo liso */}
      <rect x="112" y="10" width="78" height="114" {...line} strokeWidth={1.5} opacity={0.4} />
      <Person x={151} y={34} />
      {/* luz vindo de frente */}
      <circle cx="36" cy="40" r="11" {...line} />
      <path
        d="M36 20 L36 24 M36 56 L36 60 M16 40 L20 40 M52 40 L56 40 M22 26 L25 29 M47 51 L50 54 M22 54 L25 51 M47 29 L50 26"
        {...line}
      />
      <path d="M58 46 L128 56 M58 56 L128 92" {...line} strokeDasharray="4 5" opacity={0.55} />
    </svg>
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
