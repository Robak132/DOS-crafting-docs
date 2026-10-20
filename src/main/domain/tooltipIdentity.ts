import type { RecipeItem } from "./recipes"

/** Quantities and translations do not change which game variant is being previewed. */
export function tooltipItemKey(item: RecipeItem): string {
  return JSON.stringify([item.statsId, item.slug, item.name, item.effect?.en, item.effect?.pl])
}
