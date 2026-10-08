import type { RecipeItem, RecipeRow } from "./recipes"

export const recipeColumns = [
  { key: "ingredients", label: "Składniki" },
  { key: "result", label: "Wynik" },
  { key: "requirements", label: "Wymagania" },
  { key: "notes", label: "Uwagi / efekty" },
  { key: "tags", label: "Tagi" },
  { key: "source", label: "Źródło" },
] as const

export type RecipeGroup = { result: RecipeItem; variants: RecipeRow[] }

export function recipeCatalogSlug(tag: string, pageTags: readonly string[]): string {
  if (tag === "DOS1") return "receptury"
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
  return tags.filter((tag) => !tags.some((other) => other.startsWith(`${tag}/`)))
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
