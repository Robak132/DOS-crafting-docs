export function ItemIcon({ icon }: { icon?: string }) {
  if (!icon) return null
  return (
    <img
      class="item-icon"
      src={(import.meta.env?.BASE_URL ?? "/") + icon}
      width={32}
      height={32}
      alt=""
      loading="lazy"
      decoding="async"
    />
  )
}
