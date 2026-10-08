import type { RecipeItem, RecipeRow, TagStat } from "./recipes"

export const recipeColumns = [
  { key: "ingredients", label: "Składniki" },
  { key: "result", label: "Wynik" },
  { key: "requirements", label: "Wymagania" },
  { key: "notes", label: "Uwagi / efekty" },
  { key: "tags", label: "Tagi" },
  { key: "source", label: "Źródło" },
] as const

export type RecipeGroup = { result: RecipeItem; variants: RecipeRow[] }

export const isGameTag = (tag: string): boolean => ["DOS1", "DOS2", "DOS2-CO"].includes(tag)

const mergedCategoryTags: Record<string, string> = {
  "Typ/Mikstury": "Typ/Mikstury-i-jedzenie",
  "Typ/Jedzenie-i-picie": "Typ/Mikstury-i-jedzenie",
  "Typ/Strzaly": "Typ/Strzaly-i-granaty",
  "Typ/Granaty": "Typ/Strzaly-i-granaty",
}

export function groupRecipeTags(tags: TagStat[]): { label: string; tags: TagStat[] }[] {
  const names = new Set(tags.map((tag) => tag.tag))
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
    ["Cechy", []],
    ["Pozostałe", []],
  ])
  for (const stat of tags) {
    const tag = stat.tag
    if (isGameTag(tag) || tag === "Typ" || names.has(mergedCategoryTags[tag])) continue
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
                  : tag.startsWith("Cechy")
                    ? "Cechy"
                    : "Pozostałe"
    groups.get(label)!.push(stat)
  }
  return [...groups]
    .filter(([, tags]) => tags.length > 0)
    .map(([label, tags]) => ({
      label,
      tags: tags.sort((a, b) =>
        tagLabel(a.tag, { [a.tag]: a.label ?? a.tag }).localeCompare(
          tagLabel(b.tag, { [b.tag]: b.label ?? b.tag }),
          "pl",
        ),
      ),
    }))
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
    const key = recipe.result.slug ?? recipe.result.name
    const group = groups.get(key)
    if (group) group.variants.push(recipe)
    else groups.set(key, { result: recipe.result, variants: [recipe] })
  }
  return [...groups.values()]
}

export function visibleRecipeTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      !isGameTag(tag) && !tags.includes(mergedCategoryTags[tag]) && !tags.some((other) => other.startsWith(`${tag}/`)),
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

export function matchesRecipeQuery(recipe: RecipeRow, query: string, labels: Record<string, string>): boolean {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalizeSearch)
  const tagText = recipe.tags.map((tag) => normalizeSearch(`${tag} ${tagLabel(tag, labels)}`))
  const matchesTag = (term: string) =>
    recipe.tags.some((tag) => {
      const target = term.slice(1)
      const full = normalizeSearch(tag)
      const leaf = normalizeSearch(tag.split("/").at(-1) ?? tag)
      const label = normalizeSearch(tagLabel(tag, labels))
      return full === target || full.startsWith(`${target}/`) || leaf === target || label === target
    })
  const text = normalizeSearch(
    [
      recipe.result.name,
      ...recipe.ingredients.map((item) => item.name),
      ...tagText,
      recipe.requirements,
      recipe.notes,
      recipe.source,
    ].join(" "),
  )
  return terms.every((term) => (term.startsWith("#") ? term.length > 1 && matchesTag(term) : text.includes(term)))
}
