import fs from "node:fs"
import path from "node:path"
import { localisationLookupKey, resolveItemNames } from "./itemLocalisation"
import { isOrComboTag, requirementTokens } from "./recipeView"

export type RecipeItem = {
  /** Explicit game identity when inventory names are shared by distinct items. */
  statsId?: string
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
  /** Grupy craftingowe (#selector) używane jako składniki. */
  selectors: TagStat[]
}

type TagHierarchyNode = {
  tag: string
  label?: string
  children?: TagHierarchyNode[]
}

type TagHierarchyIndex = {
  labelByTag: Map<string, string>
  orderedTags: string[]
}

let cachedHierarchyIndex: TagHierarchyIndex | null = null

/** Zgodne z historycznymi adresami i tagami — bez polskich znaków. */
const POLISH_FOLD: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
}

function normalizeKey(value: string): string {
  return value
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gi, (ch) => POLISH_FOLD[ch.toLowerCase()] ?? ch)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export type RecipeCatalog = "dos1" | "dos2" | "dos2-overhaul"

function getTagHierarchyIndex(): TagHierarchyIndex {
  if (cachedHierarchyIndex) return cachedHierarchyIndex

  const labelByTag = new Map<string, string>()
  const orderedTags: string[] = []
  const hierarchyPath = path.join(process.cwd(), "data", "recipeTagHierarchy.json")

  try {
    const raw = fs.readFileSync(hierarchyPath, "utf8")
    const parsed = JSON.parse(raw) as { hierarchy?: TagHierarchyNode[] }
    const roots = Array.isArray(parsed.hierarchy) ? parsed.hierarchy : []

    const walk = (node: TagHierarchyNode) => {
      const canonical = node.tag?.trim().replace(/^\/+|\/+$/g, "")
      if (!canonical) return

      if (node.label?.trim()) {
        labelByTag.set(canonical, node.label.trim())
      }
      orderedTags.push(canonical)

      const children = Array.isArray(node.children) ? node.children : []
      children.forEach((child) => walk(child))
    }

    roots.forEach((root) => walk(root))
  } catch {
    // Static hierarchy file is optional during development; fallback keeps existing tags unchanged.
  }

  cachedHierarchyIndex = { labelByTag, orderedTags }
  return cachedHierarchyIndex
}

export type CechySidebarGroup = {
  parentTag: string
  label: string
  childTags: string[]
}

/** Grupy Cechy-* z recipeTagHierarchy — do sidebara (osobne sekcje zamiast jednej listy). */
export function getCechySidebarGroups(): CechySidebarGroup[] {
  const hierarchyPath = path.join(process.cwd(), "data", "recipeTagHierarchy.json")
  try {
    const raw = fs.readFileSync(hierarchyPath, "utf8")
    const parsed = JSON.parse(raw) as { hierarchy?: TagHierarchyNode[] }
    const roots = Array.isArray(parsed.hierarchy) ? parsed.hierarchy : []
    const descendants = (nodes: TagHierarchyNode[]): string[] =>
      nodes.flatMap((node) => [node.tag.trim(), ...descendants(node.children ?? [])])
    return roots
      .filter((node) => node.tag?.startsWith("Cechy-"))
      .map((node) => ({
        parentTag: node.tag.trim(),
        label: node.label?.trim() || node.tag.trim(),
        childTags: descendants(node.children ?? []),
      }))
  } catch {
    return []
  }
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
    const label = localisationLookupKey(item.name)
    const resolved = resolveItemNames(label, catalog, "selector")
    return {
      ...item,
      name: `#${resolved.name}`,
      namePl: (catalog === "dos1" ? item.namePl : undefined) ?? (resolved.namePl ? `#${resolved.namePl}` : undefined),
    }
  }
  // DOS1 zachowuje titlePl; DOS2 i Overhaul używają wyłącznie słownika Definitive Edition.
  if (catalog === "dos1" && item.namePl && item.namePl !== item.name) {
    return { ...item, name: item.name, namePl: item.namePl }
  }
  const resolved = resolveItemNames(item.name, catalog)
  const { nameQualifier, ...base } = item
  return {
    ...base,
    name: resolved.name + (nameQualifier ? ` (${nameQualifier.en})` : ""),
    namePl: resolved.namePl
      ? resolved.namePl + (nameQualifier ? ` (${nameQualifier.pl ?? nameQualifier.en})` : "")
      : undefined,
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
  displayByNormalizedTag: Map<string, string> = new Map(),
): Pick<RecipeData, "tags" | "requirements" | "selectors"> {
  const tagItems = new Map<string, Set<string>>()
  const requirementItems = new Map<string, Set<string>>()
  const selectorItems = new Map<string, Set<string>>()

  recipes.forEach((recipe) => {
    const itemKey = recipeResultKey(recipe)
    const resultTags = recipe.result.tags.length ? recipe.result.tags : recipe.tags
    resultTags.forEach((tag) => addItemToStat(tagItems, tag, itemKey))
    for (const product of recipe.extraResults ?? []) {
      const productKey = `${product.slug ?? product.name}${product.quantity ? `@${product.quantity}` : ""}`
      product.tags.forEach((tag) => addItemToStat(tagItems, tag, productKey))
    }
    requirementTokens(recipe.requirements ?? "").forEach((token) => addItemToStat(requirementItems, token, itemKey))
    const seenSelectors = new Set<string>()
    recipe.ingredients.forEach((ingredient) => {
      const selector = ingredient.selectorTag?.trim()
      if (!selector || seenSelectors.has(selector) || isOrComboTag(selector)) return
      seenSelectors.add(selector)
      addItemToStat(selectorItems, selector, itemKey)
    })
  })

  const hierarchyIndex = getTagHierarchyIndex()
  const hierarchyOrder = hierarchyIndex.orderedTags
  const hierarchyOrderIndex = new Map(hierarchyOrder.map((tag, index) => [tag, index]))
  const impliedAncestorOrder = new Map<string, number>()
  hierarchyOrder.forEach((tag, index) => {
    const segments = tag.split("/").filter(Boolean)
    for (let depth = 1; depth < segments.length; depth++) {
      const ancestor = segments.slice(0, depth).join("/")
      if (hierarchyOrderIndex.has(ancestor)) continue
      const existing = impliedAncestorOrder.get(ancestor)
      if (existing === undefined || index < existing) {
        impliedAncestorOrder.set(ancestor, index)
      }
    }
  })
  const getSortOrder = (tag: string): number => {
    const exact = hierarchyOrderIndex.get(tag)
    if (exact !== undefined) return exact * 2
    const implied = impliedAncestorOrder.get(tag)
    if (implied !== undefined) return implied * 2 - 1
    return Number.MAX_SAFE_INTEGER
  }
  const tagDepth = (tag: string): number => tag.split("/").filter(Boolean).length

  const tags: TagStat[] = [...tagItems.entries()]
    .map(([tag, items]) => {
      const leaf = tag.split("/").filter(Boolean).at(-1) ?? tag
      const label =
        hierarchyIndex.labelByTag.get(tag) ??
        displayByNormalizedTag.get(normalizeKey(tag)) ??
        displayByNormalizedTag.get(normalizeKey(leaf)) ??
        leaf
      return { tag, count: items.size, label }
    })
    .sort((a, b) => {
      const orderA = getSortOrder(a.tag)
      const orderB = getSortOrder(b.tag)
      if (orderA !== orderB) return orderA - orderB
      const depthA = tagDepth(a.tag)
      const depthB = tagDepth(b.tag)
      if (depthA !== depthB) return depthA - depthB
      return a.tag.localeCompare(b.tag)
    })

  const requirements: TagStat[] = [...requirementItems.entries()]
    .map(([tag, items]) => ({ tag, count: items.size }))
    .sort((a, b) => a.tag.localeCompare(b.tag))

  const selectors: TagStat[] = [...selectorItems.entries()]
    .map(([tag, items]) => ({
      tag,
      count: items.size,
      label: tag.replaceAll("-", " "),
    }))
    .sort((a, b) => (a.label ?? a.tag).localeCompare(b.label ?? b.tag, "pl"))

  return { tags, requirements, selectors }
}

export function resetRecipeSources(): void {
  cachedHierarchyIndex = null
}
