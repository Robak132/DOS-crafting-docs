/** Items paired with list keys that stay unique when an entry repeats ("Rat's Tail + Rat's Tail"). */
export function withKeys<T>(items: readonly T[], keyOf: (item: T) => string): [string, T][] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const base = keyOf(item)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return [count > 1 ? `${base}#${count}` : base, item]
  })
}
