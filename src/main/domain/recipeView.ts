import type { RecipeItem, RecipeRow, TagStat } from "./recipes"

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
  { key: "notes", label: "Efekt" },
  { key: "tags", label: "Tagi" },
  { key: "source", label: "Źródło" },
] as const

export type RecipeColumnKey = (typeof recipeColumns)[number]["key"]

/** DOS2 / Overhaul nie mają wymagań craftingu — bez kolumny Wymagania. */
export function recipeColumnsForCatalog(showRequirements: boolean) {
  return showRequirements ? [...recipeColumns] : recipeColumns.filter((col) => col.key !== "requirements")
}

export function catalogHasRequirements(catalog: string | undefined): boolean {
  return catalog === "dos1"
}

export type RecipeGroup = { result: RecipeItem; variants: RecipeRow[] }

/** Tagi używane do filtrowania / sortowania — wyłącznie wynik craftingu, nigdy składniki. */
export function recipeResultTags(recipe: RecipeRow): string[] {
  return recipe.result.tags.length > 0 ? recipe.result.tags : recipe.tags
}

export const isGameTag = (tag: string): boolean => ["DOS1", "DOS2", "DOS2-CO"].includes(tag)

const mergedCategoryTags: Record<string, string> = {
  "Typ/Mikstury": "Typ/Mikstury-i-jedzenie",
  "Typ/Jedzenie-i-picie": "Typ/Mikstury-i-jedzenie",
  "Typ/Strzaly": "Typ/Strzaly-i-granaty",
  "Typ/Granaty": "Typ/Strzaly-i-granaty",
}

/** Czy receptura używa grupy craftingowej (#selector) jako składnika. */
export function recipeUsesSelector(recipe: RecipeRow, selector: string): boolean {
  const target = selector.replace(/^#/, "").toLowerCase()
  return recipe.ingredients.some((ingredient) => {
    const tag = ingredient.selectorTag?.replace(/^#/, "").toLowerCase()
    if (tag && (tag === target || tag.startsWith(`${target}/`))) return true
    const name = (ingredient.namePl ?? ingredient.name).replace(/^#/, "").toLowerCase()
    return name === target
  })
}

export type RecipeTagGroup = {
  label: string
  tags: TagStat[]
  /** Sekcje Cechy — bez wcięć ścieżkowych (rodzic jest tytułem grupy). */
  flat?: boolean
}

export type CechyGroupMeta = {
  parentTag: string
  label: string
  childTags: string[]
}

export function groupRecipeTags(tags: TagStat[], cechyGroups: CechyGroupMeta[] = []): RecipeTagGroup[] {
  const names = new Set(tags.map((tag) => tag.tag))
  const byTag = new Map(tags.map((stat) => [stat.tag, stat]))
  const weapons = new Set([
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
  const armor = new Set(["Armor", "Boot-Armor", "Glove-Armor", "Helmet-Armor", "Lowerbody-Armor", "Upperbody-Armor"])
  const groups = new Map<string, TagStat[]>([
    ["Kategorie", []],
    ["Broń i narzędzia", []],
    ["Pancerze", []],
    ["Biżuteria", []],
    ["Księgi i zwoje", []],
    ["Materiały i wytwarzanie", []],
    ["Jedzenie", []],
    ["Pozostałe", []],
  ])

  const cechyParentTags = new Set(cechyGroups.map((group) => group.parentTag))
  const cechyChildToParent = new Map<string, string>()
  cechyGroups.forEach((group) => {
    group.childTags.forEach((child) => cechyChildToParent.set(child, group.parentTag))
  })
  const claimedCechy = new Set<string>()
  cechyGroups.forEach((group) => {
    claimedCechy.add(group.parentTag)
    group.childTags.forEach((child) => claimedCechy.add(child))
  })

  const cechySections: RecipeTagGroup[] = []
  // Cechy → osobne sekcje w kolejności hierarchy (nie jedna alfabetyczna lista).
  for (const group of cechyGroups) {
    const sectionTags: TagStat[] = []
    const parent = byTag.get(group.parentTag)
    if (parent) {
      sectionTags.push({ ...parent, label: "Wszystkie" })
    }
    for (const childTag of group.childTags) {
      const child = byTag.get(childTag)
      if (!child) continue
      sectionTags.push(child)
    }
    if (sectionTags.length > 0) {
      cechySections.push({ label: group.label, tags: sectionTags, flat: true })
    }
  }

  for (const stat of tags) {
    const tag = stat.tag
    // A-Or-B to rozwinięcie receptur, nie osobna kategoria w sidebarze.
    if (
      isOrComboTag(tag) ||
      isGameTag(tag) ||
      tag === "Typ" ||
      tag === "Cechy" ||
      claimedCechy.has(tag) ||
      cechyParentTags.has(tag) ||
      cechyChildToParent.has(tag) ||
      tag.startsWith("Cechy/") ||
      tag.startsWith("Cechy-") ||
      names.has(mergedCategoryTags[tag])
    )
      continue
    const label = tag.startsWith("Typ/")
      ? "Kategorie"
      : weapons.has(tag) || /(?:Weapon|Cutting-Tool)/i.test(tag)
        ? "Broń i narzędzia"
        : armor.has(tag) || /(?:Armor|Shoes|Boots)/i.test(tag)
          ? "Pancerze"
          : ["Amulet", "Ring"].includes(tag) || /Trinket/i.test(tag)
            ? "Biżuteria"
            : /(?:Skillbook|Scroll)(?:-|$)/i.test(tag)
              ? "Księgi i zwoje"
              : ["Dye", "Gold-Object", "Poison-Source", "Skull"].includes(tag) ||
                  /Essence|Rune|Soul|Source|Bone|Skull|Bottle|Nails|Dust|Wool|Yarn|Antler|Claw|Doll/i.test(tag)
                ? "Materiały i wytwarzanie"
                : /Fish|Honey|Poison-or-Rotten-Eggs|Jellyroom/i.test(tag)
                  ? "Jedzenie"
                  : "Pozostałe"
    groups.get(label)!.push(stat)
  }

  const result: RecipeTagGroup[] = []
  let cechyInserted = false
  for (const [label, groupTags] of groups) {
    if (groupTags.length === 0) continue
    result.push({
      label,
      tags: groupTags.sort((a, b) =>
        tagLabel(a.tag, { [a.tag]: a.label ?? a.tag }).localeCompare(
          tagLabel(b.tag, { [b.tag]: b.label ?? b.tag }),
          "pl",
        ),
      ),
    })
    // Cechy zaraz po Kategorie.
    if (label === "Kategorie" && cechySections.length > 0) {
      result.push(...cechySections)
      cechyInserted = true
    }
  }
  if (!cechyInserted) result.push(...cechySections)
  return result
}

export function recipeCatalogSlug(tag: string, pageTags: readonly string[]): string {
  if (tag === "DOS1") return "receptury"
  if (tag === "DOS2") return "DOS2"
  if (!pageTags.includes("DOS1") && !pageTags.includes("DOS2-CO") && pageTags.includes("DOS2")) return "DOS2"
  return tag === "DOS2-CO" || (pageTags.includes("DOS2-CO") && !pageTags.includes("DOS1"))
    ? "dos2-crafting-overhaul"
    : "receptury"
}

export function groupRecipes(recipes: RecipeRow[]): RecipeGroup[] {
  const groups = new Map<string, RecipeGroup>()
  for (const recipe of recipes) {
    const qty = recipe.result.quantity ? `@${recipe.result.quantity}` : ""
    const key = `${recipe.result.slug ?? recipe.result.name}${qty}`
    const group = groups.get(key)
    if (group) group.variants.push(recipe)
    else groups.set(key, { result: recipe.result, variants: [recipe] })
  }
  return [...groups.values()]
}

export function visibleRecipeTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      tag.trim().length > 0 &&
      !isOrComboTag(tag) &&
      !isGameTag(tag) &&
      !tags.includes(mergedCategoryTags[tag]) &&
      !tags.some((other) => other.startsWith(`${tag}/`)) &&
      // Grupy Cechy-* z hierarchy — zbyteczne na wierszu, gdy jest liść Cechy/...
      !(tag.startsWith("Cechy-") && tags.some((other) => other.startsWith("Cechy/"))),
  )
}

export function tagLabel(tag: string, labels: Record<string, string>): string {
  return labels[tag] ?? (tag.split("/").at(-1) ?? tag).replaceAll("-", " ")
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .replaceAll("Ł", "l")
    .toLowerCase()
    .replaceAll("-", " ")
}

export type RecipeSearchScope = "result" | "ingredient"

function matchesHashTag(term: string, tags: string[], labels: Record<string, string>): boolean {
  if (term.length <= 1) return false
  const target = term.slice(1)
  return tags.some((tag) => {
    const full = normalizeSearch(tag)
    const leaf = normalizeSearch(tag.split("/").at(-1) ?? tag)
    const label = normalizeSearch(tagLabel(tag, labels))
    return full === target || full.startsWith(`${target}/`) || leaf === target || label === target
  })
}

export function matchesRecipeQuery(
  recipe: RecipeRow,
  query: string,
  labels: Record<string, string>,
  scope: RecipeSearchScope = "result",
): boolean {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalizeSearch)
  if (terms.length === 0) return true

  const resultTags = recipeResultTags(recipe)
  if (scope === "ingredient") {
    const ingredientTags = recipe.ingredients.flatMap((item) => {
      const tags = [...item.tags]
      if (item.selectorTag) tags.push(item.selectorTag)
      return tags
    })
    const text = normalizeSearch(
      recipe.ingredients
        .flatMap((item) => [item.name, item.namePl, item.selectorTag ? `#${item.selectorTag}` : ""])
        .filter(Boolean)
        .join(" "),
    )
    return terms.every((term) =>
      term.startsWith("#") ? matchesHashTag(term, ingredientTags, labels) : text.includes(term),
    )
  }

  const tagText = resultTags.map((tag) => normalizeSearch(`${tag} ${tagLabel(tag, labels)}`))
  const effectText = [recipe.notes, formatEffectNote(recipe.notes ?? "")].filter(Boolean)
  const text = normalizeSearch(
    [recipe.result.name, recipe.result.namePl, ...tagText, ...effectText].filter(Boolean).join(" "),
  )
  return terms.every((term) => (term.startsWith("#") ? matchesHashTag(term, resultTags, labels) : text.includes(term)))
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
export function formatEffectNote(note: string): string {
  const trimmed = note.trim()
  if (!trimmed || trimmed === "-") return ""
  let text = trimmed
  for (const [pattern, replacement] of EFFECT_PHRASES) text = text.replace(pattern, replacement)
  for (const [pattern, replacement] of EFFECT_WORDS) text = text.replace(pattern, replacement)
  return text.replace(/\s+/g, " ").trim()
}

const EFFECT_LINE_RE =
  /^(add\b|scales with\b|stats increase\b|\+?\d|restore\b|grants?\b|provides?\b|increases?\b|decreases?\b|boosts?\b)/i
const REMARK_LINE_RE =
  /^(make sure\b|you can\b|buy\b|find\b|requires?\b|check\b|every\b|boost amount\b|skill book\b|not\b|use\b|black diamond\b|example\b)/i

/** Czy fragment wygląda jak efekt przedmiotu (staty / „Add …”), a nie instrukcja. */
export function looksLikeEffectNote(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed === "-") return false
  if (REMARK_LINE_RE.test(trimmed)) return false
  if (EFFECT_LINE_RE.test(trimmed)) return true
  // Krótkie frazy ze znanymi słowami efektów
  if (trimmed.length <= 48 && EFFECT_WORDS.some(([pattern]) => pattern.test(trimmed))) return true
  return false
}

/**
 * Rozdziela legacy „Uwagi” na efekt vs uwagi (instrukcje).
 * Zdania efektowe → effect; reszta → remarks.
 */
export function splitEffectAndRemarks(raw: string): { effect: string; remarks: string } {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === "-") return { effect: "", remarks: "" }

  const parts = trimmed
    .split(/\s*;\s*/)
    .flatMap((chunk) => chunk.split(/(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/))
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 1) {
    return looksLikeEffectNote(trimmed) ? { effect: trimmed, remarks: "" } : { effect: "", remarks: trimmed }
  }

  const effects: string[] = []
  const remarks: string[] = []
  for (const part of parts) {
    if (looksLikeEffectNote(part)) effects.push(part)
    else remarks.push(part)
  }
  // Gdy nic nie sklasyfikowano jako efekt, a całość jest krótka i wygląda na efekt — całość to efekt
  if (effects.length === 0 && looksLikeEffectNote(trimmed)) {
    return { effect: trimmed, remarks: "" }
  }
  return {
    effect: effects.join("; "),
    remarks: remarks.join(" "),
  }
}

function uniqueDisplayNotes(recipes: RecipeRow[], field: "notes" | "remarks"): string[] {
  const seen = new Set<string>()
  const values: string[] = []
  for (const recipe of recipes) {
    const raw = recipe[field]?.trim()
    if (!raw || raw === "-") continue
    const display = field === "notes" ? formatEffectNote(raw) || raw : raw
    const key = normalizeSearch(display)
    if (!key || seen.has(key)) continue
    seen.add(key)
    values.push(display)
  }
  return values
}

/** Unikalne efekty wyniku (sekcja „Efekt”). */
export function uniqueItemEffects(recipes: RecipeRow[]): string[] {
  return uniqueDisplayNotes(recipes, "notes")
}

/** Unikalne uwagi / instrukcje (sekcja „Uwagi”). */
export function uniqueItemRemarks(recipes: RecipeRow[]): string[] {
  return uniqueDisplayNotes(recipes, "remarks")
}

/** Czy receptura używa danego przedmiotu jako składnika (po slug lub nazwie PL/EN). */
export function recipeUsesItem(recipe: RecipeRow, itemSlug: string | undefined, nameKeys: Set<string>): boolean {
  return recipe.ingredients.some((ingredient) => {
    if (itemSlug && ingredient.slug === itemSlug) return true
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

export type CatalogView = "items" | "recipes"

/** Kategoria receptury pochodzi z tagu Typ wyniku; przedmiot może należeć do wielu tagów. */
export function groupCatalogByTags(recipes: RecipeRow[], view: CatalogView, labels: Record<string, string>) {
  const sections = new Map<string, RecipeRow[]>()
  for (const recipe of recipes) {
    const tags = visibleRecipeTags(recipeResultTags(recipe))
    const categories = view === "recipes" ? tags.filter((tag) => tag.startsWith("Typ/")) : tags
    for (const tag of categories.length > 0 ? categories : [""]) {
      const section = sections.get(tag) ?? []
      section.push(recipe)
      sections.set(tag, section)
    }
  }
  return [...sections]
    .map(([tag, rows]) => ({
      tag,
      label: tag ? tagLabel(tag, labels) : "Bez kategorii",
      recipes: rows,
    }))
    .sort((a, b) => (a.tag === "" ? 1 : b.tag === "" ? -1 : a.label.localeCompare(b.label, "pl")))
}

/** Lista przedmiotów pomija ilość produkowaną przez poszczególne receptury. */
export function catalogItems(recipes: RecipeRow[]): RecipeItem[] {
  const items = new Map<string, RecipeItem>()
  for (const { result } of recipes) {
    const key = result.slug ?? result.name
    if (!items.has(key)) items.set(key, { ...result, quantity: undefined })
  }
  return [...items.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"))
}

/** Jeden wiersz przedmiotu zbiera efekty i tagi ze wszystkich jego receptur. */
export function catalogItemRows(recipes: RecipeRow[]) {
  const variants = new Map<string, RecipeRow[]>()
  for (const recipe of recipes) {
    const key = recipe.result.slug ?? recipe.result.name
    const rows = variants.get(key) ?? []
    rows.push(recipe)
    variants.set(key, rows)
  }
  return catalogItems(recipes).map((item) => {
    const rows = variants.get(item.slug ?? item.name) ?? []
    return {
      item,
      effects: uniqueItemEffects(rows),
      tags: visibleRecipeTags([...new Set(rows.flatMap(recipeResultTags))]),
    }
  })
}
