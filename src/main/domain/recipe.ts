import { EffectNote } from "./effectNote"
import { Item, type ItemData } from "./item"
import type { ItemGroups } from "./itemGroup"
import { Requirements } from "./requirements"
import type { SearchQuery } from "./searchQuery"
import { tagHierarchy } from "./tagHierarchy"
import type { TagLabels } from "./tagLabels"

/** A recipe as stored in the recipe library and in the generated catalog JSON. */
export type RecipeData = {
  /** Official game vocabulary for saved effect notes. */
  effectLabels?: Record<string, string>
  /** Zero-based ingredient slot modified in place instead of creating another item. */
  transformsIngredient?: number
  /** Source recipe shared by expanded ingredient alternatives. */
  sourceRecipeIds?: string[]
  /**
   * Set on an upgrade, whose result is no game item but the boost itself: the first ingredient is the item
   * it is applied to, and these are the categories that item may be when no resolved group names it.
   */
  targetTags?: string[]
  id: string
  ingredients: ItemData[]
  result: ItemData
  /** Further products of the same craft, made at the same time as `result` (e.g. scrap from disassembly). */
  extraResults?: ItemData[]
  tags: string[]
  requirements: string
  /** Efekt przedmiotu („Efekt”) — np. Add Loremaster. */
  notes: string
  /** Uwagi / instrukcje craftingu — nie efekt. */
  remarks: string
  /** Where the game teaches it: the recipe books by their English names, or the mod adding it. */
  source: string
  /** The same books by their Polish names. */
  sourcePl?: string
}

/** Where a query must match: the products, the ingredients, or either ("all"). */
export type RecipeSearchScope = "result" | "ingredient" | "all"

/** One craft: its ingredients and the products it makes. Serializes back to the JSON it was read from. */
export class Recipe {
  declare effectLabels?: Record<string, string>
  declare transformsIngredient?: number
  declare sourceRecipeIds?: string[]
  declare targetTags?: string[]
  declare id: string
  declare ingredients: Item[]
  declare result: Item
  declare extraResults?: Item[]
  declare tags: string[]
  declare requirements: string
  declare notes: string
  declare remarks: string
  declare source: string
  declare sourcePl?: string

  constructor(data: RecipeData) {
    Object.assign(this, data)
    this.ingredients = data.ingredients.map(Item.from)
    this.result = Item.from(data.result)
    if (data.extraResults) this.extraResults = data.extraResults.map(Item.from)
  }

  static from(this: void, data: RecipeData): Recipe {
    return data instanceof Recipe ? data : new Recipe(data)
  }

  /**
   * A row for an item that no recipe makes (a raw ingredient), so the item list shows, searches and filters it
   * like any other item. It is never a craft: the recipe list does not show it.
   */
  static listing(item: Item): Recipe {
    return new Recipe({
      id: `item:${item.slug ?? item.name}`,
      result: item.with({ quantity: undefined }),
      ingredients: [],
      tags: item.tags,
      requirements: "",
      notes: "",
      remarks: "",
      source: "",
    })
  }

  /** Where it comes from, in the chosen language. */
  sourceText(lang: "pl" | "en"): string {
    return ((lang === "pl" && this.sourcePl) || this.source).trim()
  }

  /** Whether it only lists an item no recipe makes (see {@link listing}). */
  get isListing(): boolean {
    return this.id.startsWith("item:")
  }

  /** Whether it is an upgrade: its result is a boost applied to the first ingredient (see {@link targetTags}). */
  get isUpgrade(): boolean {
    return this.targetTags !== undefined
  }

  /** The ingredients the craft uses up: all of them, except the item an upgrade is applied to. */
  consumedIngredients(): Item[] {
    return this.isUpgrade ? this.ingredients.slice(1) : this.ingredients
  }

  /**
   * Whether it is an upgrade applying to the item: membership in the target's group when the catalog
   * resolved one, otherwise the target categories (e.g. one for any weapon applies to a bow).
   */
  appliesTo(itemTags: string[], slug: string | undefined, groups?: ItemGroups): boolean {
    if (!this.targetTags) return false
    const target = this.ingredients[0]
    const group = target.groupId ? groups?.[target.groupId] : undefined
    if (group) return group.includes(slug)
    return this.targetTags.some((category) => itemTags.some((tag) => tagHierarchy.isWithin(tag, category)))
  }

  /** A copy with some fields changed; the recipe itself stays as it is. */
  with(changes: Partial<RecipeData>): Recipe {
    return new Recipe({ ...this, ...changes })
  }

  /** Every product of the craft: the main result first, then the items made alongside it. */
  results(): Item[] {
    return this.extraResults?.length ? [this.result, ...this.extraResults] : [this.result]
  }

  /** Every item the craft can give: each item of a random pool, otherwise the products. */
  obtainableItems(): Item[] {
    return this.result.pool ?? this.results()
  }

  /** Tagi używane do filtrowania / sortowania — wyłącznie wynik craftingu, nigdy składniki. */
  resultTags(): string[] {
    const main = this.result.tags.length > 0 ? this.result.tags : this.tags
    if (!this.extraResults?.length) return main
    return [...new Set([...main, ...this.extraResults.flatMap((item) => item.tags)])]
  }

  /** The tags of one of its products: the recipe's own for the main result. */
  tagsOf(product: Item): string[] {
    return product === this.result ? this.resultTags() : product.tags
  }

  /** Identity of the main result with its quantity: recipes making the same number of one item share it. */
  resultKey(): string {
    const quantity = this.result.quantity ? `@${this.result.quantity}` : ""
    return `${this.result.slug ?? this.result.name}${quantity}`
  }

  /** The product of the craft that is this item; the main result unless the item is made alongside it. */
  productFor(item: Item | undefined): Item {
    const key = item && (item.slug ?? item.name)
    return (this.extraResults ?? []).find((product) => (product.slug ?? product.name) === key) ?? this.result
  }

  /** Like {@link productFor}, but an extra product also counts when only its English name matches. */
  productNamed(item: Item): Item {
    const keys = item.nameKeys()
    return (
      (this.extraResults ?? []).find(
        (product) => (item.slug && product.slug === item.slug) || [...product.nameKeys()].some((key) => keys.has(key)),
      ) ?? this.result
    )
  }

  /** Whether one of its products has this page. */
  makes(slug: string | undefined): boolean {
    return this.results().some((product) => product.slug === slug)
  }

  /** Czy losowy wynik receptury może dać dany przedmiot (po slug lub nazwie PL/EN). */
  canRoll(slug: string | undefined, nameKeys: Set<string>): boolean {
    return (this.result.pool ?? []).some((item) => item.matches(slug, nameKeys))
  }

  /**
   * Whether it uses the item up as an ingredient: by its page or its name, and for an upgrade also through
   * membership in an ingredient group. The item an upgrade is applied to is not used up.
   */
  uses(slug: string | undefined, nameKeys: Set<string>, groups?: ItemGroups): boolean {
    return this.consumedIngredients().some((ingredient) =>
      this.isUpgrade && ingredient.groupId
        ? Boolean(slug && groups?.[ingredient.groupId]?.includes(slug))
        : ingredient.matches(slug, nameKeys),
    )
  }

  /** Whether it takes this resolved group as an ingredient. */
  usesGroup(groupId: string): boolean {
    return this.ingredients.some((item) => item.isGroup() && item.groupId === groupId)
  }

  get requirementList(): Requirements {
    return new Requirements(this.requirements)
  }

  /** The saved effect note in the reader's language; empty when the recipe has none. */
  effectNote(lang: "pl" | "en"): string {
    const raw = this.notes.trim()
    if (!raw || raw === "-") return ""
    return lang === "pl" ? new EffectNote(raw, this.effectLabels).polish() || raw : raw
  }

  /** Whether the query finds this recipe by its products (names, tags, effects), its ingredients, or either. */
  matches(query: SearchQuery, labels: TagLabels, scope: RecipeSearchScope = "result"): boolean {
    if (scope === "all") return this.matches(query, labels, "result") || this.matches(query, labels, "ingredient")
    if (query.isEmpty) return true
    if (scope === "ingredient")
      return query.matches(
        this.ingredients.flatMap((item) => [item.name, item.namePl, item.selectorTag ? `#${item.selectorTag}` : ""]),
      )
    const tagText = this.resultTags().map((tag) => `${tag} ${labels.label(tag)}`)
    const effectText = [
      this.notes,
      new EffectNote(this.notes, this.effectLabels).polish(),
      this.result.effect?.en,
      this.result.effect?.pl,
    ]
    const productText = [...this.results(), ...(this.result.pool ?? [])].flatMap((item) => [item.name, item.namePl])
    return query.matches([...productText, ...tagText, ...effectText])
  }
}
