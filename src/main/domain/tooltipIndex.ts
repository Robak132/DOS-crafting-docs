import type { Item } from "./item"
import type { Recipe } from "./recipe"
import { TextKey } from "./textKey"

/** Lookups for item tooltips, built once per catalog: hover and pointer movement never scan all recipes. */
export class TooltipIndex {
  private readonly itemsBySlug = new Map<string, Item>()
  private readonly itemsByName = new Map<string, Item>()
  private readonly itemsByVariant = new Map<string, Item>()
  private readonly resultsByStats = new Map<string, Set<Recipe>>()
  private readonly resultsBySlug = new Map<string, Set<Recipe>>()
  private readonly resultsByName = new Map<string, Set<Recipe>>()
  private readonly order = new Map<Recipe, number>()
  private readonly cache = new WeakMap<Item, Recipe[]>()

  constructor(recipes: Recipe[]) {
    recipes.forEach((row, position) => {
      this.order.set(row, position)
      this.indexResults(row)
      this.indexItems(row)
    })
    // Aggregate item lists have no selected recipe variant. Keep all of their effects
    // attached to the recipes instead of presenting the last result as the item.
    for (const [items, results] of [
      [this.itemsBySlug, this.resultsBySlug],
      [this.itemsByName, this.resultsByName],
    ] as const) {
      for (const [key, item] of items) {
        const effects = new Set(
          [...(results.get(key) ?? [])].map((row) => {
            const product = row.productNamed(item)
            return JSON.stringify([product.effect?.en, product.effect?.pl])
          }),
        )
        if (effects.size > 1) items.set(key, item.with({ effect: undefined }))
      }
    }
  }

  /** The item a link shows: by its variant key, else its page, else its name. */
  find(slug: string, name: string, variantKey?: string): Item | undefined {
    if (variantKey) return this.itemsByVariant.get(variantKey)
    return this.itemsBySlug.get(slug) ?? this.itemsByName.get(TextKey.item(name))
  }

  /** The recipes making the item, in catalog order; an item with an effect only those giving that effect. */
  recipesFor(item: Item): Recipe[] {
    const cached = this.cache.get(item)
    if (cached) return cached
    let direct: Set<Recipe> | undefined
    if (item.statsId) direct = this.resultsByStats.get(item.statsId)
    else if (item.slug) direct = this.resultsBySlug.get(item.slug)
    const rows = new Set(direct)
    for (const key of item.statsId ? [] : item.nameKeys()) {
      for (const row of this.resultsByName.get(key) ?? []) rows.add(row)
    }
    const result = [...rows]
      .filter((row) => {
        if (!item.effect) return true
        const product = row.productNamed(item)
        return product.effect?.en === item.effect.en && product.effect?.pl === item.effect.pl
      })
      .sort((a, b) => this.order.get(a)! - this.order.get(b)!)
    this.cache.set(item, result)
    return result
  }

  private indexResults(row: Recipe) {
    if (row.result.statsId) add(this.resultsByStats, row.result.statsId, row)
    if (row.result.slug) add(this.resultsBySlug, row.result.slug, row)
    if (!row.result.statsId) for (const key of row.result.nameKeys()) add(this.resultsByName, key, row)
    // Items made alongside the result, or rolled from a random pool, are crafted by this recipe too.
    for (const item of [...(row.extraResults ?? []), ...(row.result.pool ?? [])]) {
      if (item.slug) add(this.resultsBySlug, item.slug, row)
      for (const key of item.nameKeys()) add(this.resultsByName, key, row)
    }
  }

  private indexItems(row: Recipe) {
    for (const item of [row.result, ...(row.extraResults ?? []), ...(row.result.pool ?? []), ...row.ingredients]) {
      if (item.selectorTag) continue
      const key = item.tooltipKey
      if (!this.itemsByVariant.has(key)) this.itemsByVariant.set(key, item)
      if (item.slug && (row.results().includes(item) || !this.itemsBySlug.has(item.slug)))
        this.itemsBySlug.set(item.slug, item)
      this.itemsByName.set(item.nameKey, item)
    }
  }
}

function add(map: Map<string, Set<Recipe>>, key: string, row: Recipe) {
  const rows = map.get(key) ?? new Set<Recipe>()
  rows.add(row)
  map.set(key, rows)
}
