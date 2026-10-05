// Ilustrações do tutorial do provador virtual e a silhueta-guia sobre a câmera.
// Todas usam currentColor para seguir o tema.
import type { ReactNode } from "react";

/** "upper": da cabeça ao quadril (peças de cima). "full": corpo inteiro (calças, calçados). */
export type TryOnFraming = "upper" | "full";

interface IllustrationProps {
  className?: string | undefined;
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
    <img src="/provador01.png" alt="" aria-hidden="true" className={className} />
  );
}

export function DistanceIllustration({ className }: IllustrationProps & { framing: TryOnFraming }) {
  return (
      <img src="/provador02.png" alt="" aria-hidden="true" className={className} />
    );
}

export function LightIllustration({ className }: IllustrationProps) {
  return (
    <img src="/provador03.png" alt="" aria-hidden="true" className={className} />
  );
}

// Silhueta de frente com braços levemente afastados, desenhada num espaço de 100x200.
const BODY_PATH =
  "M45 33 L45 39 C38 40 31 41 27 45 C23 50 22 58 21 68 L17 106 C17 110 23 111 24 107 L28 72 L31 64 " +
  "L32 92 C32 100 31 106 32 112 L35 186 C35 190 28 191 28 194 L47 194 L48 186 L50 120 L52 186 L53 194 " +
  "L72 194 C72 191 65 190 65 186 L68 112 C69 106 68 100 68 92 L69 64 L72 72 L76 107 C77 111 83 110 83 106 " +
  "L79 68 C78 58 77 50 73 45 C69 41 62 40 55 39 L55 33";

// Versões de desktop (webcam) das imagens do celular, no mesmo estilo: quadro 2:3,
// fundo preto, traço branco e verde-limão de destaque. Espessuras em unidades do
// quadro de 1024x1536; dentro de grupos com scale, divididas pela escala.
const INK = "#0b0b0b";
const CHALK = "#f2f2f2";
const LIME = "#a3e635";

function IllustrationFrame({ className, children }: IllustrationProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet" aria-hidden="true" className={className}>
      <rect width="1024" height="1536" fill={INK} />
      <text x="523" y="168" textAnchor="middle" fill={CHALK} fontSize="46" fontWeight="300" letterSpacing="22">
        RESERVA
      </text>
      {children}
    </svg>
  );
}

function Silhouette({ transform, scale, fill = "none" }: { transform: string; scale: number; fill?: string }) {
  return (
    <g transform={transform} fill={fill} stroke={CHALK} strokeWidth={4 / scale} strokeLinejoin="round">
      <ellipse cx="50" cy="20" rx="11" ry="13" />
      <path d={BODY_PATH} />
    </g>
  );
}

// Notebook de frente, com a webcam acesa e a pessoa enquadrada na tela (560 de largura).
function Laptop({ x, y, scale }: { x: number; y: number; scale: number }) {
  const sw = (width: number) => width / scale;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} strokeLinejoin="round">
      <path d="M-40 360 L600 360 L650 420 L-90 420 Z" fill={INK} stroke={CHALK} strokeWidth={sw(4)} />
      <path d="M220 392 L340 392" stroke="#6b6b6b" strokeWidth={sw(3)} strokeLinecap="round" />
      <rect width="560" height="360" rx="18" fill={INK} stroke={CHALK} strokeWidth={sw(4)} />
      <rect x="22" y="34" width="516" height="304" rx="4" fill="#121212" stroke="#5a5a5a" strokeWidth={sw(2)} />
      <circle cx="280" cy="17" r="18" fill={LIME} opacity="0.2" />
      <circle cx="280" cy="17" r="6" fill={LIME} />
      <Silhouette transform="translate(210 48) scale(1.4)" scale={1.4 * scale} />
      <path
        d="M186 76 V44 H218 M342 44 H374 V76 M374 300 V332 H342 M218 332 H186 V300"
        fill="none"
        stroke={LIME}
        strokeWidth={sw(4)}
        strokeLinecap="round"
      />
    </g>
  );
}

export function LaptopSetupIllustration({ className }: IllustrationProps) {
  return (
    <IllustrationFrame className={className}>
      <path d="M940 330 V1100" stroke="#333" strokeWidth={3} />
      <rect y="1100" width="1024" height="436" fill="#121212" />
      <path d="M0 1100 H1024" stroke="#4a4a4a" strokeWidth={3} />
      <Laptop x={176} y={596} scale={1.2} />
    </IllustrationFrame>
  );
}

export function LaptopDistanceIllustration({ className }: IllustrationProps) {
  return (
    <IllustrationFrame className={className}>
      <path d="M950 480 V890" stroke="#333" strokeWidth={3} />
      <rect x="430" y="890" width="594" height="44" fill="#141414" stroke="#4a4a4a" strokeWidth={3} />
      <Laptop x={659} y={739} scale={0.36} />
      <g fill="none" stroke={LIME} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M470 792 L636 772" strokeDasharray="18 12" />
        <path d="M611.9 789 L636 772 L608.5 761.2 M497.5 802.8 L470 792 L494.1 775" />
      </g>
      {/* Pessoa de costas em primeiro plano, cortada embaixo como nas imagens do celular. */}
      <Silhouette transform="translate(-10 438) scale(6)" scale={6} fill={INK} />
    </IllustrationFrame>
  );
}

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
