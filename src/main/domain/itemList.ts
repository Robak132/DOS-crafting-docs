import type { Item, Lang } from "./item"
import type { Recipe } from "./recipe"
import { TagSidebar } from "./tagSidebar"
import { TextKey } from "./textKey"

/** One row of the item list: the item with the effects and tags of all the recipes making it. */
export type ItemRow = { item: Item; effects: string[]; tags: string[] }

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

  /** Unikalne efekty wyniku (sekcja „Efekt”): saved notes, else the game's effects of the products. */
  effects(lang: Lang = "pl"): string[] {
    // Saved effect notes describe the main result, never the items made alongside it.
    const notes = unique(
      this.recipes.filter((row) => row.productFor(this.item) === row.result).map((row) => row.effectNote(lang)),
    )
    if (notes.length) return notes
    const effects = [this.item, ...this.recipes.map((row) => row.productFor(this.item))].flatMap((entry) => {
      const value = (lang === "pl" && entry?.effect?.pl?.trim()) || entry?.effect?.en?.trim()
      return value ? [value] : []
    })
    return [...new Set(effects)]
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

  /** Jeden wiersz przedmiotu zbiera efekty i tagi ze wszystkich jego receptur. */
  rows(lang: Lang = "pl"): ItemRow[] {
    const variants = new Map<string, Recipe[]>()
    for (const recipe of this.recipes) {
      for (const product of recipe.results()) {
        const key = product.slug ?? product.name
        const rows = variants.get(key) ?? []
        rows.push(recipe)
        variants.set(key, rows)
      }
    }
    const items = this.items()
    // The list reads alphabetically in the language it is shown in.
    if (lang === "pl") items.sort((a, b) => a.shownName(lang).localeCompare(b.shownName(lang), "pl"))
    return items.map((item) => {
      const rows = variants.get(item.slug ?? item.name) ?? []
      return {
        item,
        effects: new ItemRecipes(rows, item).effects(lang),
        tags: TagSidebar.visibleTags([...new Set(rows.flatMap((row) => row.tagsOf(row.productFor(item))))]),
      }
    })
  }
}
