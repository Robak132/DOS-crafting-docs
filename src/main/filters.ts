import type { RecipeRow } from "./domain/recipes"
import {
  matchesCraftingMax,
  matchesRecipeQuery,
  recipeResultTags,
  recipeUsesSelector,
  requirementTokens,
} from "./domain/recipeView"
import type { Game } from "./routing"
export type Filters = {
  include: string[]
  exclude: string[]
  requirements: string[]
  requirementsExclude: string[]
  craftingMax: number | null
  scope: "result" | "ingredient"
  selectors: string[]
  query: string
}
export const emptyFilters = (): Filters => ({
  include: [],
  exclude: [],
  requirements: [],
  requirementsExclude: [],
  craftingMax: null,
  scope: "result",
  selectors: [],
  query: "",
})
export function restoreFilters(game: Game, search = ""): Filters {
  let stored = emptyFilters()
  try {
    stored = { ...stored, ...JSON.parse(sessionStorage.getItem(`crafting.filters.${game}`) ?? "{}") }
  } catch {
    /* unavailable storage */
  }
  const params = new URLSearchParams(search)
  const fields = [
    "tag",
    "include",
    "exclude",
    "q",
    "requirement",
    "requirements",
    "requirementsExclude",
    "craftingMax",
    "selector",
    "as",
  ]
  if (fields.some((key) => params.has(key))) {
    stored = emptyFilters()
    stored.include = (params.get("include") ?? params.get("tag") ?? "").split(",").filter(Boolean)
    stored.exclude = (params.get("exclude") ?? "").split(",").filter(Boolean)
    stored.requirements = (params.get("requirements") ?? params.get("requirement") ?? "").split(",").filter(Boolean)
    stored.requirementsExclude = (params.get("requirementsExclude") ?? "").split(",").filter(Boolean)
    stored.selectors = (params.get("selector") ?? "").split(",").filter(Boolean)
    stored.query = params.get("q") ?? ""
    stored.scope = params.get("as") === "ingredient" ? "ingredient" : "result"
    const max = Number(params.get("craftingMax"))
    stored.craftingMax = Number.isInteger(max) && max >= 1 && max <= 5 ? max : null
  }
  return game === "dos1" ? stored : { ...stored, requirements: [], requirementsExclude: [], craftingMax: null }
}
export function filterRecipes(recipes: RecipeRow[], filters: Filters, labels: Record<string, string>): RecipeRow[] {
  const tagMatch = (tags: string[], target: string) =>
    tags.some((tag) => tag === target || tag.startsWith(target + "/"))
  return recipes.filter((recipe) => {
    const tags = recipeResultTags(recipe)
    const reqs = requirementTokens(recipe.requirements).map((value) => value.toLowerCase())
    if (!filters.include.every((tag) => tagMatch(tags, tag)) || filters.exclude.some((tag) => tagMatch(tags, tag)))
      return false
    if (filters.requirements.length && !filters.requirements.some((value) => reqs.includes(value.toLowerCase())))
      return false
    if (filters.requirementsExclude.some((value) => reqs.includes(value.toLowerCase()))) return false
    if (filters.craftingMax !== null && !matchesCraftingMax(recipe.requirements, filters.craftingMax)) return false
    if (
      filters.scope === "ingredient" &&
      filters.selectors.length &&
      !filters.selectors.some((value) => recipeUsesSelector(recipe, value))
    )
      return false
    return matchesRecipeQuery(recipe, filters.query, labels, filters.scope)
  })
}
export function filtersToSearch(filters: Filters, view: string): string {
  const params = new URLSearchParams({ view })
  for (const field of ["include", "exclude", "requirements", "requirementsExclude"] as const) {
    if (filters[field].length) params.set(field, filters[field].join(","))
  }
  if (filters.query) params.set("q", filters.query)
  if (filters.scope !== "result") params.set("as", filters.scope)
  if (filters.selectors.length) params.set("selector", filters.selectors.join(","))
  if (filters.craftingMax !== null) params.set("craftingMax", String(filters.craftingMax))
  return params.toString()
}
