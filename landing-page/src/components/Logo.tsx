/* The Yaadein mark. Transparent PNG — her profile is a cut-out, so on dark
   grounds it needs the light plate variant or the face fills in and vanishes. */

export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/* For dark surfaces: a soft lilac plate so the negative space reads as face. */
export function LogoPlate({ size = 30, tile = 38 }: { size?: number; tile?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[10px] bg-white"
      style={{ width: tile, height: tile }}
    >
      <Logo size={size} />
    </span>
  )
}
