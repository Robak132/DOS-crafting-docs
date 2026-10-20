import type { RecipeItem, RecipeRow } from "./recipes"
import { itemIconKey } from "./itemIcons"
import { itemNameKeys } from "./recipeView"
import { parseItemQuantity } from "./recipeQuantity"

/** Built once per catalog. Hover and pointer movement never scan all recipes. */
export function buildTooltipIndex(recipes: RecipeRow[]) {
  const itemsBySlug = new Map<string, RecipeItem>()
  const itemsByName = new Map<string, RecipeItem>()
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
      if (item.slug && (item === row.result || !itemsBySlug.has(item.slug))) itemsBySlug.set(item.slug, item)
      itemsByName.set(itemIconKey(item.name), item)
    }
  })
  return {
    find(slug: string, name: string) {
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
      const result = [...rows].sort((a, b) => order.get(a)! - order.get(b)!)
      cache.set(item, result)
      return result
    },
  }
}
