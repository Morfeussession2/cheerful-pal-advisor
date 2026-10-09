/* const RESERVA_LOGO =
  "https://lojausereserva.vtexassets.com/assets/vtex.file-manager-graphql/images/3517f907-b0fa-497e-9c9e-d983f2fb24fc___4fa9c06b65acc2308dc375dfe0cd8778.svg";
*/

const mockups = [
  /* Reserva fica desativada enquanto a entrada principal estiver focada na Spelho.
  {
    name: "Reserva",
    description: "Entre na experiência Reserva e explore o provador virtual.",
    href: "/reserva",
    logo: RESERVA_LOGO,
    logoAlt: "Reserva",
    className: "bg-[#f3f1ec] text-[#151515]",
    logoClassName: "h-10 w-52",
  },
  */
  {
    name: "Spelho",
    description: "Explore novas peças e experimente virtualmente com a Spelho.",
    href: "/spelho",
    logo: "/Spelhosvg_Prancheta%201.svg",
    logoAlt: "Spelho",
    className: "bg-[#171717] text-white",
    logoClassName: "h-12 w-52",
  },
] as const;

export function MockupSelector() {
  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#eae8e2] px-5 py-12 text-[#171717] sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.9),transparent_65%)]" />
      <header className="mb-10 max-w-xl text-center sm:mb-14">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-black/55">Provador virtual</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-5xl">Escolha sua experiência</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/60 sm:text-base">
          Selecione uma marca para entrar em seu provador virtual.
        </p>
      </header>

      <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 sm:gap-6">
        {mockups.map((mockup) => (
          <a
            key={mockup.name}
            href={mockup.href}
            className={`group flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl border border-black/10 p-6 shadow-[0_16px_50px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_65px_rgba(0,0,0,0.14)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black sm:min-h-80 sm:rounded-3xl sm:p-9 ${mockup.className}`}
          >
            <div className="flex min-h-28 items-center justify-center rounded-xl bg-white/55 p-5 backdrop-blur-md sm:min-h-36 sm:rounded-2xl">
              <img src={mockup.logo} alt={mockup.logoAlt} className={`max-w-full object-contain ${mockup.logoClassName}`} />
            </div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-medium sm:text-2xl">{mockup.name}</h2>
                <p className="mt-1 max-w-xs text-sm leading-5 opacity-70">{mockup.description}</p>
              </div>
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-current/20 text-xl transition-transform duration-300 group-hover:translate-x-1">→</span>
            </div>
          </a>
        ))}
      </div>
      <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-black/45">Duas marcas · uma experiência de prova virtual</p>
    </main>
  );
}
