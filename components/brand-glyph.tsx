/** Símbolo próprio Nimbus: nuvem geométrica com dobra de página. */
export function BrandGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 44H40L51 33V30C51 23 46 19 40 20C37 10 23 10 20 22C8 20 5 35 13 42C14 43 16 44 17 44Z" />
      <path d="M40 44V33H51" />
    </svg>
  );
}
