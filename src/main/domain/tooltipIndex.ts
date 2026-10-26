import type { RecipeItem, RecipeRow } from "./recipes"
import { itemIconKey } from "./itemIcons"
import { itemNameKeys } from "./recipeView"
import { parseItemQuantity } from "./recipeQuantity"
import { tooltipItemKey } from "./tooltipIdentity"
import { recipeResults } from "./recipeResults"

/** The product of a recipe that is this item: an extra product it names, otherwise the main result. */
function productOf(row: RecipeRow, item: RecipeItem): RecipeItem {
  const keys = itemNameKeys(item.name)
  return (
    (row.extraResults ?? []).find(
      (product) =>
        (item.slug && product.slug === item.slug) || [...itemNameKeys(product.name)].some((key) => keys.has(key)),
    ) ?? row.result
  )
}

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
  const indexResults = (row: RecipeRow) => {
    if (row.result.statsId) add(resultsByStats, row.result.statsId, row)
    if (row.result.slug) add(resultsBySlug, row.result.slug, row)
    if (!row.result.statsId) for (const key of itemNameKeys(row.result.name)) add(resultsByName, key, row)
    // Items made alongside the result, or rolled from a random pool, are crafted by this recipe too.
    for (const item of [...(row.extraResults ?? []), ...(row.result.pool ?? [])]) {
      if (item.slug) add(resultsBySlug, item.slug, row)
      for (const key of itemNameKeys(item.name)) add(resultsByName, key, row)
    }
  }
  const indexItems = (row: RecipeRow) => {
    for (const item of [row.result, ...(row.extraResults ?? []), ...(row.result.pool ?? []), ...row.ingredients]) {
      if (item.selectorTag) continue
      const key = tooltipItemKey(item)
      if (!itemsByVariant.has(key)) itemsByVariant.set(key, item)
      if (item.slug && (recipeResults(row).includes(item) || !itemsBySlug.has(item.slug)))
        itemsBySlug.set(item.slug, item)
      itemsByName.set(itemIconKey(item.name), item)
    }
  }
  recipes.forEach((row, position) => {
    order.set(row, position)
    indexResults(row)
    indexItems(row)
  })
  // Aggregate item lists have no selected recipe variant. Keep all of their effects
  // attached to the recipes instead of presenting the last result as the item.
  for (const [items, results] of [
    [itemsBySlug, resultsBySlug],
    [itemsByName, resultsByName],
  ] as const) {
    for (const [key, item] of items) {
      const effects = new Set(
        [...(results.get(key) ?? [])].map((row) => {
          const product = productOf(row, item)
          return JSON.stringify([product.effect?.en, product.effect?.pl])
        }),
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
      let direct: Set<RecipeRow> | undefined
      if (item.statsId) direct = resultsByStats.get(item.statsId)
      else if (item.slug) direct = resultsBySlug.get(item.slug)
      const rows = new Set(direct)
      for (const key of item.statsId ? [] : itemNameKeys(item.name, parseItemQuantity(item.name).base)) {
        for (const row of resultsByName.get(key) ?? []) rows.add(row)
      }
      const result = [...rows]
        .filter(
          (row) =>
            !item.effect ||
            (productOf(row, item).effect?.en === item.effect.en && productOf(row, item).effect?.pl === item.effect.pl),
        )
        .sort((a, b) => order.get(a)! - order.get(b)!)
      cache.set(item, result)
      return result
    },
  }
}
