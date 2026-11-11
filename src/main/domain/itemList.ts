import type { Item, Lang } from "./item"
import type { Recipe } from "./recipe"
import { TagSidebar } from "./tagSidebar"
import { TextKey } from "./textKey"

/**
 * One entry of the item list: the item, its effects and tags, the recipes making it and the random results
 * that can give it. An item with neither is only ever used as an ingredient.
 */
export type ItemRow = { item: Item; effects: string[]; tags: string[]; crafts: Recipe[]; rolls: Recipe[] }

/** What a set of recipes says about one item: its effects and the remarks on making it. */
export class ItemRecipes {
  /**
   * @param recipes the recipes making the item
   * @param item the item; without it, the main result of each recipe
   */
  constructor(
    private readonly recipes: Recipe[],
    private readonly item?: Item,
  ) {}

  /**
   * Unikalne efekty wyniku (sekcja „Efekt”). The game's own effects come first: they are read from its Stats,
   * while saved notes are hand-written and only stand in where the game data says nothing.
   */
  effects(lang: Lang = "pl"): string[] {
    const effects = [this.item, ...this.recipes.map((row) => row.productFor(this.item))].flatMap((entry) => {
      const value = (lang === "pl" && entry?.effect?.pl?.trim()) || entry?.effect?.en?.trim()
      return value ? [value] : []
    })
    if (effects.length) return [...new Set(effects)]
    // Saved effect notes describe the main result, never the items made alongside it.
    return unique(
      this.recipes.filter((row) => row.productFor(this.item) === row.result).map((row) => row.effectNote(lang)),
    )
  }

  /** Unikalne uwagi / instrukcje (sekcja „Uwagi”). */
  remarks(): string[] {
    return unique(
      this.recipes.map((row) => {
        const raw = row.remarks.trim()
        return raw === "-" ? "" : raw
      }),
    )
  }
}

/** Effects as bullet points: a saved effect lists its parts as "+1 Strength; +1 Finesse". */
export function effectBullets(effects: string[]): string[] {
  return [
    ...new Set(
      effects
        .flatMap((effect) => effect.split(/;\s*/))
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ]
}

/** Non-empty texts, each once however it is written. */
function unique(texts: string[]): string[] {
  const seen = new Set<string>()
  const values: string[] = []
  for (const text of texts) {
    const key = TextKey.search(text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    values.push(text)
  }
  return values
}

/** The items a list of recipes makes, each once; quantities belong to recipes, not items. */
export class ItemList {
  constructor(private readonly recipes: Recipe[]) {}

  /** Every item the recipes can give, alphabetically; groups and random pools are not items. */
  items(): Item[] {
    const items = new Map<string, Item>()
    // A random pool is not an item; each item it can roll is.
    for (const item of this.recipes.flatMap((recipe) => recipe.obtainableItems())) {
      if (item.isGroup()) continue
      const key = item.slug ?? item.name
      if (items.has(key)) continue
      // A pool level belongs to the roll, not to the item.
      const entry = item.with({ quantity: undefined })
      delete entry.requirements
      items.set(key, entry)
    }
    return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"))
  }

  /** Items the recipes take as ingredients but never give, each once: raw materials, tools and stations. */
  stock(): Item[] {
    const obtainable = new Set(this.items().map((item) => item.slug ?? item.name))
    const stock = new Map<string, Item>()
    for (const item of this.recipes.flatMap((recipe) => recipe.ingredients)) {
      const key = item.slug ?? item.name
      if (item.isGroup() || item.selectorTag || obtainable.has(key) || stock.has(key)) continue
      stock.set(key, item.with({ quantity: undefined }))
    }
    return [...stock.values()].sort((a, b) => a.name.localeCompare(b.name, "en"))
  }

  /** Jeden wpis przedmiotu zbiera efekty, tagi i receptury ze wszystkich jego wariantów. */
  rows(lang: Lang = "pl"): ItemRow[] {
    const variants = new Map<string, Recipe[]>()
    const rolls = new Map<string, Recipe[]>()
    const add = (map: Map<string, Recipe[]>, item: Item, recipe: Recipe) => {
      const key = item.slug ?? item.name
      const rows = map.get(key) ?? []
      if (!rows.includes(recipe)) rows.push(recipe)
      map.set(key, rows)
    }
    for (const recipe of this.recipes) {
      for (const product of recipe.results()) add(variants, product, recipe)
      for (const item of recipe.result.pool ?? []) add(rolls, item, recipe)
    }
    const items = this.items()
    // The list reads alphabetically in the language it is shown in.
    if (lang === "pl") items.sort((a, b) => a.shownName(lang).localeCompare(b.shownName(lang), "pl"))
    return items.map((item) => {
      const key = item.slug ?? item.name
      const rows = variants.get(key) ?? []
      const crafts = rows.filter((row) => !row.isListing)
      const rolled = rolls.get(key) ?? []
      const poolTags = rolled.flatMap(
        (row) => row.result.pool!.find((entry) => (entry.slug ?? entry.name) === key)!.tags,
      )
      return {
        item,
        effects: new ItemRecipes(crafts, item).effects(lang),
        tags: TagSidebar.visibleTags([
          ...new Set([...rows.flatMap((row) => row.tagsOf(row.productFor(item))), ...poolTags]),
        ]),
        crafts,
        rolls: rolled,
      }
    })
  }
}
