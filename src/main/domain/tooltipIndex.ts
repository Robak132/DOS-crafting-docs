import type { RecipeItem, RecipeRow } from "./recipes"
import { itemIconKey } from "./itemIcons"
import { itemNameKeys } from "./recipeView"
import { parseItemQuantity } from "./recipeQuantity"
import { tooltipItemKey } from "./tooltipIdentity"

/** Built once per catalog. Hover and pointer movement never scan all recipes. */
export function buildTooltipIndex(recipes: RecipeRow[]) {
  const itemsBySlug = new Map<string, RecipeItem>()
  const itemsByName = new Map<string, RecipeItem>()
  const itemsByVariant = new Map<string, RecipeItem>()
  const resultsByStats = new Map<string, Set<RecipeRow>>()
  const resultsBySlug = new Map<string, Set<RecipeRow>>()
  const resultsByName = new Map<string, Set<RecipeRow>>()
  const order = new Map<RecipeRow, number>()
  const cache = new WeakMap<RecipeItem, RecipeRow[]>()
  const add = (map: Map<string, Set<RecipeRow>>, key: string, row: RecipeRow) => {
    const rows = map.get(key) ?? new Set<RecipeRow>()
    rows.add(row)
    map.set(key, rows)
  }
  recipes.forEach((row, position) => {
    order.set(row, position)
    if (row.result.statsId) add(resultsByStats, row.result.statsId, row)
    if (row.result.slug) add(resultsBySlug, row.result.slug, row)
    if (!row.result.statsId) for (const key of itemNameKeys(row.result.name)) add(resultsByName, key, row)
    for (const item of [row.result, ...row.ingredients]) {
      if (item.selectorTag) continue
      const key = tooltipItemKey(item)
      if (!itemsByVariant.has(key)) itemsByVariant.set(key, item)
      if (item.slug && (item === row.result || !itemsBySlug.has(item.slug))) itemsBySlug.set(item.slug, item)
      itemsByName.set(itemIconKey(item.name), item)
    }
  })
  // Aggregate item lists have no selected recipe variant. Keep all of their effects
  // attached to the recipes instead of presenting the last result as the item.
  for (const [items, results] of [
    [itemsBySlug, resultsBySlug],
    [itemsByName, resultsByName],
  ] as const) {
    for (const [key, item] of items) {
      const effects = new Set(
        [...(results.get(key) ?? [])].map((row) => JSON.stringify([row.result.effect?.en, row.result.effect?.pl])),
      )
      if (effects.size > 1) items.set(key, { ...item, effect: undefined })
    }
  }
  return {
    find(slug: string, name: string, variantKey?: string) {
      if (variantKey) return itemsByVariant.get(variantKey)
      return itemsBySlug.get(slug) ?? itemsByName.get(itemIconKey(name))
    },
    recipesFor(item: RecipeItem) {
      const cached = cache.get(item)
      if (cached) return cached
      const rows = new Set(
        item.statsId ? resultsByStats.get(item.statsId) : item.slug ? resultsBySlug.get(item.slug) : undefined,
      )
      for (const key of item.statsId ? [] : itemNameKeys(item.name, parseItemQuantity(item.name).base)) {
        for (const row of resultsByName.get(key) ?? []) rows.add(row)
      }
      const result = [...rows]
        .filter(
          (row) =>
            !item.effect || (row.result.effect?.en === item.effect.en && row.result.effect?.pl === item.effect.pl),
        )
        .sort((a, b) => order.get(a)! - order.get(b)!)
      cache.set(item, result)
      return result
    },
  }
}
