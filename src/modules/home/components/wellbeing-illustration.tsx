// Ilustración original de paisaje; no representa una sede ni una identidad oficial.
export function WellbeingIllustration() {
  return <div className="relative mx-auto w-full max-w-lg" aria-hidden="true">
    <svg viewBox="0 0 520 420" className="h-auto w-full" fill="none">
      <defs>
        <clipPath id="landscape-clip"><rect x="45" y="24" width="430" height="360" rx="180" /></clipPath>
        <pattern id="landscape-grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cad9cb" /></pattern>
      </defs>
      <rect width="520" height="420" fill="url(#landscape-grid)" />
      <g clipPath="url(#landscape-clip)">
        <rect x="45" y="24" width="430" height="360" fill="#e5efdf" />
        <circle cx="337" cy="115" r="50" fill="#d9e4b2" />
        <path d="M20 285 146 112 246 251 316 168 520 312V440H20Z" fill="#b6cdb4" />
        <path d="m0 340 162-136 119 99 91-107 168 177v67H0Z" fill="#6f9e7b" />
        <path d="M0 346c99 6 164-51 241-25 92 31 146-23 279-14v133H0Z" fill="#357254" />
        <path d="M0 402c97-62 154-20 251-40s164-4 269 29v49H0Z" fill="#184d3b" />
        <path d="M292 281c-73 38-87 45-34 59 71 18 61 27-21 46" stroke="#edf1d4" strokeWidth="13" strokeLinecap="round" />
        <path d="m116 138 30-26 27 37-28-12Z" fill="#dce8d6" />
      </g>
      <rect x="44.5" y="23.5" width="431" height="361" rx="180.5" stroke="#d2dfd0" />
      <g transform="translate(28 96)">
        <rect width="66" height="66" rx="20" fill="white" stroke="#d9e3d8" />
        <path d="M22 33h8l4-12 6 24 4-12h7" transform="translate(-3 0)" stroke="#246747" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(422 238)">
        <rect width="66" height="66" rx="20" fill="white" stroke="#d9e3d8" />
        <path d="M22 39c0-13 10-19 24-19 0 15-7 24-19 23m-6 5 18-19" stroke="#246747" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="m416 72 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#73925b" />
      <circle cx="82" cy="332" r="5" fill="#9bb980" />
    </svg>
    <div className="relative mx-auto -mt-4 w-fit rounded-full border bg-background px-5 py-2.5 text-xs font-medium text-primary shadow-sm">
      Conectamos bienestar y territorio
    </div>
  </div>;
}
