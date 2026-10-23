import type { RecipeCatalog, RecipeItem } from "./recipes"

export type ItemIconMap = Record<RecipeCatalog, Record<string, string>>

export function itemIconKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll("ł", "l")
    .replace(/[^a-z0-9]/g, "")
}

/** Effects come from the game's Stats entry, so every item on one Stats ID shares them. */
export function itemEffectKey(item: Pick<RecipeItem, "name" | "statsId">): string {
  return itemIconKey(item.statsId ?? item.name)
}

export function itemDataKey(item: Pick<RecipeItem, "name" | "statsId" | "dataKey">): string {
  return item.dataKey ?? itemIconKey(item.statsId ?? item.name)
}

/**
 * Data follows the game identity. A Stats ID behind several item pages is generic (one
 * "WPN_Sword_1H" for several sword templates) or one item listed twice, so those pages keep
 * their own name as the key.
 */
export function assignDataKeys(items: RecipeItem[]): void {
  const pages = new Map<string, Set<string>>()
  for (const item of items)
    if (item.statsId && item.slug) pages.set(item.statsId, (pages.get(item.statsId) ?? new Set()).add(item.slug))
  for (const item of items)
    if (item.statsId && !item.selectorTag)
      item.dataKey = itemIconKey((pages.get(item.statsId)?.size ?? 0) > 1 ? item.name : item.statsId)
}

export function resolveItemIcon(icons: ItemIconMap, game: RecipeCatalog, item: RecipeItem): string | undefined {
  if (item.selectorTag) return undefined
  return icons[game][itemDataKey(item)]
}
