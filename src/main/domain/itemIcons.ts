import type { RecipeCatalog, RecipeItem } from "./recipes"

export type ItemIconMap = Record<RecipeCatalog, Record<string, string>>

export function itemIconKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll("ł", "l")
    .replace(/[^a-z0-9]/g, "")
}

export function itemDataKey(item: Pick<RecipeItem, "name" | "statsId">): string {
  return itemIconKey(item.statsId ?? item.name)
}

export function resolveItemIcon(icons: ItemIconMap, game: RecipeCatalog, item: RecipeItem): string | undefined {
  if (item.selectorTag) return undefined
  return icons[game][itemDataKey(item)]
}
