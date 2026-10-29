import type { Recipe } from "./recipe"
import { tagHierarchy } from "./tagHierarchy"

/** How many distinct items a tag or a requirement covers, with the label readers see. */
export type TagStat = {
  tag: string
  count: number
  label?: string
}

/** Liczniki tagów i wymagań = liczba unikalnych przedmiotów (nie receptur). */
export class RecipeStats {
  private readonly tagItems = new Map<string, Set<string>>()
  private readonly requirementItems = new Map<string, Set<string>>()

  /**
   * @param recipes the recipes counted
   * @param tagLabels labels of tags the hierarchy file does not name
   */
  constructor(
    recipes: Recipe[],
    private readonly tagLabels: Record<string, string> = {},
  ) {
    for (const recipe of recipes) this.add(recipe)
  }

  /** Tags in hierarchy order, each with the number of items it covers. */
  tags(): TagStat[] {
    return [...this.tagItems.entries()]
      .map(([tag, items]) => ({
        tag,
        count: items.size,
        label: tagHierarchy.label(tag) ?? this.tagLabels[tag] ?? tag,
      }))
      .sort((a, b) => tagHierarchy.position(a.tag) - tagHierarchy.position(b.tag) || a.tag.localeCompare(b.tag))
  }

  /** Requirements in alphabetical order, each with the number of items that need it. */
  requirements(): TagStat[] {
    return [...this.requirementItems.entries()]
      .map(([tag, items]) => ({ tag, count: items.size }))
      .sort((a, b) => a.tag.localeCompare(b.tag))
  }

  private add(recipe: Recipe) {
    const itemKey = recipe.resultKey()
    const resultTags = recipe.result.tags.length ? recipe.result.tags : recipe.tags
    tagHierarchy.withImpliedParents(resultTags).forEach((tag) => count(this.tagItems, tag, itemKey))
    for (const product of recipe.extraResults ?? []) {
      const productKey = (product.slug ?? product.name) + (product.quantity ? "@" + product.quantity : "")
      tagHierarchy.withImpliedParents(product.tags).forEach((tag) => count(this.tagItems, tag, productKey))
    }
    recipe.requirementList.tokens().forEach((token) => count(this.requirementItems, token, itemKey))
  }
}

function count(map: Map<string, Set<string>>, key: string, itemKey: string): void {
  let items = map.get(key)
  if (!items) {
    items = new Set()
    map.set(key, items)
  }
  items.add(itemKey)
}
