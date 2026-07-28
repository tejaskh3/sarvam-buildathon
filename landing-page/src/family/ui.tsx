

/* The one presentational helper more than one tab needs. Anything used by a
   single tab lives with that tab instead. */

export function Loading({ text }: { text: string }) {
  return (
    <p className="text-tx-tertiary flex items-center gap-2 py-6 text-[14px]">
      <span className="bg-sr-indigo-700 h-1.5 w-1.5 animate-pulse rounded-full" />
      {text}
    </p>
  )
}
