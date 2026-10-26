import type { RecipeItem, RecipeRow, TagStat } from "./recipes"
import { isItemGroup } from "./itemGroups"
import { tooltipItemKey } from "./tooltipIdentity"
import { displayItemName } from "./itemName"
import { recipeResults } from "./recipeResults"
import { isCategoryTag, isTagWithin, tagAncestors, traitSections } from "./tagTree"

/** A trait or effect tag: anything in the hierarchy outside the item categories. */
const isTraitTag = (tag: string) => traitSections.some((section) => isTagWithin(tag, section.tag))

/** dead = szary, mid = zielony, end = fioletowy (bez Node — używane też w inline scripts). */
export type ItemCraftRole = "dead" | "mid" | "end"

export function itemCraftRoleClass(role: ItemCraftRole | undefined): string {
  if (!role) return ""
  return `item-craft-${role}`
}

/** Legacy markery A-Or-B — nie filtrujemy po nich w UI. */
export function isOrComboTag(tag: string): boolean {
  return /-Or-/i.test(tag)
}

export const recipeColumns = [
  { key: "result", label: "Przedmiot" },
  { key: "ingredients", label: "Receptura" },
  { key: "requirements", label: "Wymagania" },
  { key: "tags", label: "Tagi" },
  { key: "source", label: "Źródło" },
] as const

export type RecipeColumnKey = (typeof recipeColumns)[number]["key"]

/** DOS2 / Overhaul nie mają wymagań craftingu — bez kolumny Wymagania. */
export function recipeColumnsForCatalog(showRequirements: boolean) {
  return recipeColumns.filter((col) => showRequirements || col.key !== "requirements")
}

export type RecipeGroup = { key: string; result: RecipeItem; results: RecipeItem[]; variants: RecipeRow[] }

/** Tagi używane do filtrowania / sortowania — wyłącznie wynik craftingu, nigdy składniki. */
export function recipeResultTags(recipe: RecipeRow): string[] {
  const main = recipe.result.tags.length > 0 ? recipe.result.tags : recipe.tags
  if (!recipe.extraResults?.length) return main
  return [...new Set([...main, ...recipe.extraResults.flatMap((item) => item.tags)])]
}

export { recipeResults }

export const isGameTag = (tag: string): boolean => ["DOS1", "DOS2", "DOS2-CO"].includes(tag)

/** Czy receptura używa grupy craftingowej (#selector) jako składnika. */
export function recipeUsesSelector(recipe: RecipeRow, selector: string): boolean {
  const target = selector.replace(/^#/, "").toLowerCase()
  return recipe.ingredients.some((ingredient) => {
    const tag = ingredient.selectorTag?.replace(/^#/, "").toLowerCase()
    if (tag === target) return true
    const name = (ingredient.namePl ?? ingredient.name).replace(/^#/, "").toLowerCase()
    return name === target
  })
}

export type TagFilterNode = TagStat & { children?: TagFilterNode[] }

const statLabel = (stat: TagStat) => tagLabel(stat.tag, { [stat.tag]: stat.label ?? stat.tag })

/** Most entries first; equal counts alphabetically. */
export function sortTagStats<T extends TagStat>(tags: T[]): T[] {
  return [...tags].sort((a, b) => b.count - a.count || statLabel(a).localeCompare(statLabel(b), "pl"))
}

export function nestTagStats(tags: TagStat[]): TagFilterNode[] {
  const nodes = new Map(tags.map((tag) => [tag.tag, { ...tag, children: [] as TagFilterNode[] }]))
  const roots: TagFilterNode[] = []
  for (const node of nodes.values()) {
    const parent = tagAncestors(node.tag).find((ancestor) => nodes.has(ancestor))
    if (parent) nodes.get(parent)!.children.push(node)
    else roots.push(node)
  }
  for (const node of nodes.values()) node.children = sortTagStats(node.children)
  return sortTagStats(roots)
}

export type RecipeTagGroup = {
  label: string
  tags: TagFilterNode[]
  /** Sekcje Cechy — bez wcięć ścieżkowych (rodzic jest tytułem grupy). */
  flat?: boolean
}

export type CechyGroupMeta = {
  parentTag: string
  label: string
  childTags: string[]
}

const WEAPON_TAGS = new Set([
  "Weapon",
  "Axe",
  "Bow",
  "Crossbow",
  "Dagger",
  "Knife",
  "Mace",
  "One-Handed-Sword",
  "Spear",
  "Sword",
  "Two-Handed-Axe",
  "Two-Handed-Mace",
  "Two-Handed-Sword",
])
const ARMOR_TAGS = new Set(["Armor", "Boot-Armor", "Glove-Armor", "Helmet-Armor", "Lowerbody-Armor", "Upperbody-Armor"])
const MATERIAL_PATTERN = /Essence|Rune|Soul|Source|Bone|Skull|Bottle|Nails|Dust|Wool|Yarn|Antler|Claw|Doll/i

/** Sidebar groups in display order, each with the test that puts a tag into it; the last takes the rest. */
const TAG_GROUPS: [string, (tag: string) => boolean][] = [
  ["Kategorie", isCategoryTag],
  ["Broń i narzędzia", (tag) => WEAPON_TAGS.has(tag) || /Weapon|Cutting-Tool/i.test(tag)],
  ["Pancerze", (tag) => ARMOR_TAGS.has(tag) || /Armor|Shoes|Boots/i.test(tag)],
  ["Biżuteria", (tag) => ["Amulet", "Ring"].includes(tag) || /Trinket/i.test(tag)],
  ["Księgi i zwoje", (tag) => /(?:Skillbook|Scroll)(?:-|$)/i.test(tag)],
  [
    "Materiały i wytwarzanie",
    (tag) => ["Dye", "Gold-Object", "Poison-Source", "Skull"].includes(tag) || MATERIAL_PATTERN.test(tag),
  ],
  ["Jedzenie", (tag) => /Fish|Honey|Poison-or-Rotten-Eggs|Jellyroom/i.test(tag)],
  ["Pozostałe", () => true],
]

/** Cechy → osobne sekcje w kolejności hierarchy (nie jedna alfabetyczna lista). */
function cechySectionsFor(byTag: Map<string, TagStat>, cechyGroups: CechyGroupMeta[]): RecipeTagGroup[] {
  const sections: RecipeTagGroup[] = []
  for (const group of cechyGroups) {
    const parent = byTag.get(group.parentTag)
    const sectionTags: TagStat[] = parent ? [{ ...parent, label: "Wszystkie" }] : []
    for (const childTag of group.childTags) {
      const child = byTag.get(childTag)
      if (child) sectionTags.push(child)
    }
    if (sectionTags.length > 0) sections.push({ label: group.label, tags: nestTagStats(sectionTags), flat: true })
  }
  return sections
}

export function groupRecipeTags(tags: TagStat[], cechyGroups: CechyGroupMeta[] = []): RecipeTagGroup[] {
  const claimedCechy = new Set(cechyGroups.flatMap((group) => [group.parentTag, ...group.childTags]))
  const cechySections = cechySectionsFor(new Map(tags.map((stat) => [stat.tag, stat])), cechyGroups)
  // A-Or-B to rozwinięcie receptur, nie osobna kategoria w sidebarze.
  const hidden = (tag: string) =>
    isOrComboTag(tag) || isGameTag(tag) || tag === "Category" || claimedCechy.has(tag) || isTraitTag(tag)
  const groups = new Map<string, TagStat[]>(TAG_GROUPS.map(([label]) => [label, []]))
  for (const stat of tags) {
    if (hidden(stat.tag)) continue
    const [label] = TAG_GROUPS.find(([, test]) => test(stat.tag))!
    groups.get(label)!.push(stat)
  }

  const result: RecipeTagGroup[] = []
  for (const [label, groupTags] of groups) {
    if (groupTags.length === 0) continue
    const sortedTags = sortTagStats(groupTags)
    result.push({ label, tags: label === "Kategorie" ? nestTagStats(sortedTags) : sortedTags })
  }
  // Cechy zaraz po Kategorie.
  const categories = result.findIndex((group) => group.label === "Kategorie")
  result.splice(categories < 0 ? result.length : categories + 1, 0, ...cechySections)
  return result
}

export function groupRecipes(recipes: RecipeRow[]): RecipeGroup[] {
  const groups = new Map<string, RecipeGroup>()
  for (const recipe of recipes) {
    const modification = recipe.transformsIngredient === undefined ? "" : `@${recipe.notes}`
    // Recipes with the same products share one result cell.
    const key =
      recipeResults(recipe)
        .map((item) => tooltipItemKey(item) + (item.quantity ? "@" + item.quantity : ""))
        .join("+") + modification
    const group = groups.get(key)
    if (group) group.variants.push(recipe)
    else groups.set(key, { key, result: recipe.result, results: recipeResults(recipe), variants: [recipe] })
  }
  return [...groups.values()]
}

export function visibleRecipeTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      tag.trim().length > 0 &&
      !isOrComboTag(tag) &&
      !isGameTag(tag) &&
      !tags.some((other) => other !== tag && isTagWithin(other, tag)),
  )
}

export function tagLabel(tag: string, labels: Record<string, string>): string {
  return labels[tag] ?? tag.replaceAll("-", " ")
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .replaceAll("Ł", "l")
    .toLowerCase()
    .replaceAll("-", " ")
}

/** Where a query must match: the products, the ingredients, or either ("all"). */
export type RecipeSearchScope = "result" | "ingredient" | "all"

export function matchesRecipeQuery(
  recipe: RecipeRow,
  query: string,
  labels: Record<string, string>,
  scope: RecipeSearchScope = "result",
): boolean {
  if (scope === "all")
    return (
      matchesRecipeQuery(recipe, query, labels, "result") || matchesRecipeQuery(recipe, query, labels, "ingredient")
    )
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalizeSearch)
  if (terms.length === 0) return true

  const resultTags = recipeResultTags(recipe)
  if (scope === "ingredient") {
    const text = normalizeSearch(
      recipe.ingredients
        .flatMap((item) => [item.name, item.namePl, item.selectorTag ? `#${item.selectorTag}` : ""])
        .filter(Boolean)
        .join(" "),
    )
    return terms.every((term) => text.includes(term))
  }

  const tagText = resultTags.map((tag) => normalizeSearch(`${tag} ${tagLabel(tag, labels)}`))
  const effectText = [
    recipe.notes,
    formatEffectNote(recipe.notes ?? "", recipe.effectLabels),
    recipe.result.effect?.en,
    recipe.result.effect?.pl,
  ].filter(Boolean)
  const productText = [...recipeResults(recipe), ...(recipe.result.pool ?? [])].flatMap((item) => [
    item.name,
    item.namePl,
  ])
  const text = normalizeSearch([...productText, ...tagText, ...effectText].filter(Boolean).join(" "))
  return terms.every((term) => text.includes(term))
}

const EFFECT_PHRASES: Array<[RegExp, string]> = [
  [/\bScales With Intelligence\b/gi, "Skaluje się z Inteligencją"],
  [/\bScales With Constution\b/gi, "Skaluje się z Kondycją"],
  [/\bScales With Constitution\b/gi, "Skaluje się z Kondycją"],
  [/\bStats Increase with Crafting Level\b/gi, "Statystyki rosną z poziomem Craftingu"],
  [/\bStats Increase with Blacksmithing Level\b/gi, "Statystyki rosną z poziomem Blacksmithing"],
  [/\bStats Increase with Hero Level\b/gi, "Statystyki rosną z poziomem bohatera"],
  [/\bAdd\b/gi, "Dodaje"],
]

const EFFECT_WORDS: Array<[RegExp, string]> = [
  [/\bIntelligence\b/gi, "Inteligencja"],
  [/\bStrength\b/gi, "Siła"],
  [/\bFinesse\b/gi, "Finezja"],
  [/\bConstitution\b/gi, "Kondycja"],
  [/\bMemory\b/gi, "Pamięć"],
  [/\bWits\b/gi, "Bystrość"],
  [/\bSpeed\b/gi, "Szybkość"],
  [/\bInitiative\b/gi, "Inicjatywa"],
  [/\bMovement\b/gi, "Ruch"],
  [/\bHeal\b/gi, "leczenie"],
  [/\bPoison Resist\b/gi, "odporność na truciznę"],
  [/\bEarth Resist\b/gi, "odporność na ziemię"],
  [/\bAir Resist\b/gi, "odporność na powietrze"],
  [/\bFire Resist\b/gi, "odporność na ogień"],
  [/\bWater Resist\b/gi, "odporność na wodę"],
  [/\bResist-All\b/gi, "odporność na wszystko"],
  [/\bLucky Charm\b/gi, "Szczęście"],
  [/\bLoremaster\b/gi, "Znawca"],
  [/\bDrunk chance\b/gi, "szansa na upicie"],
  [/\bPoison chance\b/gi, "szansa na truciznę"],
  [/\bTurns\b/gi, "tury"],
]

/** Czytelny opis efektu przedmiotu — lekkie tłumaczenie EN→PL. */
export function formatEffectNote(note: string, labels: Record<string, string> = {}): string {
  const trimmed = note.trim()
  if (!trimmed || trimmed === "-") return ""
  let text = trimmed
  for (const [pattern, replacement] of EFFECT_PHRASES) text = text.replace(pattern, replacement)
  for (const [pattern, replacement] of EFFECT_WORDS)
    text = text.replace(pattern, (match) => labels[match.toLocaleLowerCase()] ?? replacement)
  return text.replace(/\s+/g, " ").trim()
}

function uniqueDisplayNotes(recipes: RecipeRow[], field: "notes" | "remarks", lang: "pl" | "en" = "pl"): string[] {
  const seen = new Set<string>()
  const values: string[] = []
  for (const recipe of recipes) {
    const raw = recipe[field]?.trim()
    if (!raw || raw === "-") continue
    const display = field === "notes" && lang === "pl" ? formatEffectNote(raw, recipe.effectLabels) || raw : raw
    const key = normalizeSearch(display)
    if (!key || seen.has(key)) continue
    seen.add(key)
    values.push(display)
  }
  return values
}

/** Unikalne efekty wyniku (sekcja „Efekt”). */
/** The product of a recipe that is this item; the main result unless the item is made alongside it. */
function productFor(recipe: RecipeRow, item: RecipeItem | undefined): RecipeItem {
  const key = item && (item.slug ?? item.name)
  return (recipe.extraResults ?? []).find((product) => (product.slug ?? product.name) === key) ?? recipe.result
}

export function uniqueItemEffects(recipes: RecipeRow[], lang: "pl" | "en" = "pl", item?: RecipeItem): string[] {
  // Saved effect notes describe the main result, never the items made alongside it.
  const notes = uniqueDisplayNotes(
    recipes.filter((row) => productFor(row, item) === row.result),
    "notes",
    lang,
  )
  if (notes.length) return notes
  const effects = [item, ...recipes.map((row) => productFor(row, item))].flatMap((entry) => {
    const value = (lang === "pl" && entry?.effect?.pl?.trim()) || entry?.effect?.en?.trim()
    return value ? [value] : []
  })
  return [...new Set(effects)]
}

/** Unikalne uwagi / instrukcje (sekcja „Uwagi”). */
export function uniqueItemRemarks(recipes: RecipeRow[]): string[] {
  return uniqueDisplayNotes(recipes, "remarks")
}

/** Czy receptura używa danego przedmiotu jako składnika (po slug lub nazwie PL/EN). */
export function recipeUsesItem(recipe: RecipeRow, itemSlug: string | undefined, nameKeys: Set<string>): boolean {
  return recipe.ingredients.some((ingredient) => {
    if (itemSlug && ingredient.slug) return ingredient.slug === itemSlug
    const keys = [ingredient.name, ingredient.namePl]
      .filter((value): value is string => Boolean(value))
      .map((value) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replaceAll("ł", "l")
          .replaceAll("Ł", "l")
          .toLowerCase()
          .replace(/^#/, "")
          .replace(/[^a-z0-9]+/g, ""),
      )
    return keys.some((key) => key && nameKeys.has(key))
  })
}

/** Czy losowy wynik receptury może dać dany przedmiot (po slug lub nazwie PL/EN). */
export function recipeRollsItem(recipe: RecipeRow, itemSlug: string | undefined, nameKeys: Set<string>): boolean {
  return (recipe.result.pool ?? []).some((item) => {
    if (itemSlug && item.slug) return item.slug === itemSlug
    return [...itemNameKeys(item.name, item.namePl)].some((key) => nameKeys.has(key))
  })
}

export function itemNameKeys(...names: Array<string | undefined>): Set<string> {
  return new Set(
    names
      .filter((value): value is string => Boolean(value))
      .map((value) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replaceAll("ł", "l")
          .replaceAll("Ł", "l")
          .toLowerCase()
          .replace(/^#/, "")
          .replace(/[^a-z0-9]+/g, ""),
      )
      .filter(Boolean),
  )
}

export function groupRequirementStats(requirements: TagStat[]): { label: string; items: TagStat[] }[] {
  const groups = [
    { label: "Crafting", items: [] as TagStat[], test: (tag: string) => /^Crafting\b/i.test(tag) },
    { label: "Blacksmithing", items: [] as TagStat[], test: (tag: string) => /^Blacksmithing\b/i.test(tag) },
    { label: "Inne", items: [] as TagStat[], test: () => true },
  ]
  for (const req of requirements) {
    const group = groups.find((entry) => entry.test(req.tag)) ?? groups[groups.length - 1]
    group.items.push(req)
  }
  return groups.filter((group) => group.items.length > 0)
}

/** Tokeny wymagań receptury (np. "Crafting 3"); pusty wpis → ["-"]. */
export function requirementTokens(value: string): string[] {
  const tokens = value
    .split(";")
    .map((val) => val.trim())
    .filter(Boolean)
  return tokens.length > 0 ? tokens : ["-"]
}

/**
 * Czy recepturę da się wykonać przy Crafting ≤ maxLevel.
 * Pasuje: brak wymagań, Crafting 1..maxLevel. Nie pasuje: wyższy Crafting ani same Blacksmithing/Tenebrium.
 */
export function matchesCraftingMax(requirements: string, maxLevel: number): boolean {
  if (!Number.isFinite(maxLevel) || maxLevel < 1) return true
  const tokens = requirementTokens(requirements)
  return tokens.some((token) => {
    if (token === "-") return true
    const match = /^Crafting\s+(\d+)$/i.exec(token)
    return Boolean(match && Number(match[1]) <= maxLevel)
  })
}

export const CRAFTING_MAX_LEVELS = [1, 2, 3, 4, 5] as const

/** Lista przedmiotów pomija ilość produkowaną przez poszczególne receptury. */
export function catalogItems(recipes: RecipeRow[]): RecipeItem[] {
  const items = new Map<string, RecipeItem>()
  // A random pool is not an item; each item it can roll is.
  for (const item of recipes.flatMap((recipe) => recipe.result.pool ?? recipeResults(recipe))) {
    if (isItemGroup(item)) continue
    const key = item.slug ?? item.name
    if (items.has(key)) continue
    // A pool level belongs to the roll, not to the item.
    const entry: RecipeItem = { ...item, quantity: undefined }
    delete entry.requirements
    items.set(key, entry)
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"))
}

/** The name a reader sees for an item in the chosen language. */
export function shownItemName(item: RecipeItem, lang: "pl" | "en"): string {
  return displayItemName(lang === "pl" ? (item.namePl ?? item.name) : item.name)
}

export type RecipeSort = "default" | "name" | "level" | "ingredients"
export const RECIPE_SORTS: readonly RecipeSort[] = ["default", "name", "level", "ingredients"]

/** Highest skill level a recipe asks for ("Crafting 3; Blacksmithing 4" → 4); none → 0. */
export function requirementLevel(requirements: string | undefined): number {
  return Math.max(0, ...requirementTokens(requirements ?? "").map(trailingNumber))
}

/** The number a text ends with ("Crafting 3" → 3); none → 0. */
function trailingNumber(text: string): number {
  let start = text.length
  while (start > 0 && text[start - 1] >= "0" && text[start - 1] <= "9") start--
  return start < text.length ? Number(text.slice(start)) : 0
}

/** Orders recipes for display; ties fall back to the result name. "default" keeps the catalog order. */
export function sortRecipes(recipes: RecipeRow[], sort: RecipeSort, lang: "pl" | "en" = "pl"): RecipeRow[] {
  if (sort === "default") return recipes
  const name = (recipe: RecipeRow) => shownItemName(recipe.result, lang)
  const key = (recipe: RecipeRow) => {
    if (sort === "level") return requirementLevel(recipe.requirements)
    if (sort === "ingredients") return recipe.ingredients.length
    return 0
  }
  return [...recipes].sort((a, b) => key(a) - key(b) || name(a).localeCompare(name(b), lang))
}

/** Jeden wiersz przedmiotu zbiera efekty i tagi ze wszystkich jego receptur. */
export function catalogItemRows(recipes: RecipeRow[], lang: "pl" | "en" = "pl") {
  const variants = new Map<string, RecipeRow[]>()
  for (const recipe of recipes) {
    for (const product of recipeResults(recipe)) {
      const key = product.slug ?? product.name
      const rows = variants.get(key) ?? []
      rows.push(recipe)
      variants.set(key, rows)
    }
  }
  const items = catalogItems(recipes)
  // The list reads alphabetically in the language it is shown in.
  if (lang === "pl") items.sort((a, b) => shownItemName(a, lang).localeCompare(shownItemName(b, lang), "pl"))
  return items.map((item) => {
    const rows = variants.get(item.slug ?? item.name) ?? []
    return {
      item,
      effects: uniqueItemEffects(rows, lang, item),
      tags: visibleRecipeTags([
        ...new Set(
          rows.flatMap((row) =>
            productFor(row, item) === row.result ? recipeResultTags(row) : productFor(row, item).tags,
          ),
        ),
      ]),
    }
  })
}
