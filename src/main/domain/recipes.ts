import { polishName } from "./itemLocalisation"
import { requirementTokens, type TraitGroup } from "./recipeView"
import { hierarchyLabel, tagDescendants, tagOrder, traitSections, withImpliedParents } from "./tagTree"

export type RecipeItem = {
  /** Game identity (Stats ID); links the item to game data. Never shown. */
  statsId?: string
  /** Key of the item's icon, effect and description data, set during static generation. */
  dataKey?: string
  /** Catalog clarification for distinct items sharing their official game name. */
  nameQualifier?: { en: string; pl?: string }
  /** Confirmed game effects, embedded during static generation. */
  effect?: { en: string; pl?: string }
  /** Relative static asset URL, exported from this game’s inventory atlas. */
  icon?: string
  craftingCategories?: string[]
  groupId?: string
  groupSize?: number
  /** Bazowa nazwa ENG (źródło w plikach / mapa lokalizacji). */
  name: string
  /** Opcjonalne tłumaczenie PL — przełączane w UI. */
  namePl?: string
  slug?: string
  tags: string[]
  selectorTag?: string
  /** Ilość poza linkiem, np. "x2" / "x3", losowa "x(1-3)" lub nieznana "x(?)". */
  quantity?: string
  /** Wynik losowany z puli: możliwe przedmioty z plików gry. Taki wynik nie ma własnej strony. */
  pool?: RecipeItem[]
  /** Element puli: najniższy poziom craftingu, od którego może wypaść (DOS1). */
  requirements?: string
}

export type RecipeRow = {
  /** Official game vocabulary for saved effect notes. */
  effectLabels?: Record<string, string>
  /** Zero-based ingredient slot modified in place instead of creating another item. */
  transformsIngredient?: number
  /** Source recipe shared by expanded ingredient alternatives. */
  sourceRecipeIds?: string[]
  id: string
  ingredients: RecipeItem[]
  result: RecipeItem
  /** Further products of the same craft, made at the same time as `result` (e.g. scrap from disassembly). */
  extraResults?: RecipeItem[]
  tags: string[]
  requirements: string
  /** Efekt przedmiotu („Efekt”) — np. Add Loremaster. */
  notes: string
  /** Uwagi / instrukcje craftingu — nie efekt. */
  remarks: string
  source: string
}

export type RecipeUpgrade = {
  id: string
  effect: { en: string; pl?: string }
  target: RecipeItem
  /** The groups of items the upgrade applies to, resolved during data generation. */
  targets?: RecipeItem[]
  targetTags: string[]
  tags: string[]
  ingredients: RecipeItem[]
  requirements: string
  notes: string
  remarks: string
  source: string
}

export type TagStat = {
  tag: string
  count: number
  label?: string
}

export type RecipeData = {
  groups?: import("./itemGroups").ItemGroups
  recipes: RecipeRow[]
  upgrades?: RecipeUpgrade[]
  tags: TagStat[]
  requirements: TagStat[]
}

export type RecipeCatalog = "dos1" | "dos2" | "dos2-overhaul"

/** Trait sections of the sidebar, in hierarchy order, with every tag below each of them. */
export function getCechySidebarGroups(): TraitGroup[] {
  return traitSections.map((section) => ({
    parentTag: section.tag,
    label: section.label?.trim() || section.tag,
    childTags: tagDescendants(section.tag),
  }))
}

export function localizeItemForCatalog(item: RecipeItem, catalog: RecipeCatalog): RecipeItem {
  if (item.pool) {
    const { pool, ...base } = item
    return {
      ...localizeItemForCatalog(base, catalog),
      pool: pool.map((entry) => localizeItemForCatalog(entry, catalog)),
    }
  }
  if (item.selectorTag) {
    const label = item.name.replace(/^#/, "")
    const namePl = polishName(label, catalog, "selector")
    return {
      ...item,
      name: `#${label}`,
      namePl: (catalog === "dos1" ? item.namePl : undefined) ?? (namePl ? `#${namePl}` : undefined),
    }
  }
  // DOS1 zachowuje titlePl; DOS2 i Overhaul używają wyłącznie słownika Definitive Edition.
  if (catalog === "dos1" && item.namePl && item.namePl !== item.name) {
    return { ...item, name: item.name, namePl: item.namePl }
  }
  const namePl = polishName(item.name, catalog)
  const { nameQualifier, ...base } = item
  const qualifierPl = nameQualifier ? ` (${nameQualifier.pl ?? nameQualifier.en})` : ""
  return {
    ...base,
    name: item.name + (nameQualifier ? ` (${nameQualifier.en})` : ""),
    namePl: namePl ? namePl + qualifierPl : undefined,
  }
}

export function recipeResultKey(recipe: RecipeRow): string {
  const qty = recipe.result.quantity ? `@${recipe.result.quantity}` : ""
  return `${recipe.result.slug ?? recipe.result.name}${qty}`
}

function addItemToStat(map: Map<string, Set<string>>, key: string, itemKey: string): void {
  let items = map.get(key)
  if (!items) {
    items = new Set()
    map.set(key, items)
  }
  items.add(itemKey)
}

/** Liczniki = liczba unikalnych przedmiotów (nie receptur). */
export function collectRecipeStats(
  recipes: RecipeRow[],
  tagLabels: Record<string, string> = {},
): Pick<RecipeData, "tags" | "requirements"> {
  const tagItems = new Map<string, Set<string>>()
  const requirementItems = new Map<string, Set<string>>()

  recipes.forEach((recipe) => {
    const itemKey = recipeResultKey(recipe)
    const resultTags = recipe.result.tags.length ? recipe.result.tags : recipe.tags
    withImpliedParents(resultTags).forEach((tag) => addItemToStat(tagItems, tag, itemKey))
    for (const product of recipe.extraResults ?? []) {
      const productKey = (product.slug ?? product.name) + (product.quantity ? "@" + product.quantity : "")
      withImpliedParents(product.tags).forEach((tag) => addItemToStat(tagItems, tag, productKey))
    }
    requirementTokens(recipe.requirements).forEach((token) => addItemToStat(requirementItems, token, itemKey))
  })

  const tags: TagStat[] = [...tagItems.entries()]
    .map(([tag, items]) => ({
      tag,
      count: items.size,
      label: hierarchyLabel(tag) ?? tagLabels[tag] ?? tag,
    }))
    .sort((a, b) => tagOrder(a.tag) - tagOrder(b.tag) || a.tag.localeCompare(b.tag))

  const requirements: TagStat[] = [...requirementItems.entries()]
    .map(([tag, items]) => ({ tag, count: items.size }))
    .sort((a, b) => a.tag.localeCompare(b.tag))

  return { tags, requirements }
}
