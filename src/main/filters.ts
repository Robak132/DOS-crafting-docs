import { isCategoryTag, isTagWithin } from "./domain/tagTree"
import type { RecipeRow, RecipeUpgrade } from "./domain/recipes"
import { matchesUpgradeQuery } from "./domain/upgrades"
import {
  type RecipeSearchScope,
  matchesCraftingMax,
  matchesRecipeQuery,
  recipeResultTags,
  recipeUsesSelector,
  requirementTokens,
} from "./domain/recipeView"
import { catalogHref, type Game, type View } from "./routing"
export type Filters = {
  include: string[]
  exclude: string[]
  requirements: string[]
  requirementsExclude: string[]
  craftingMax: number | null
  scope: RecipeSearchScope
  selectors: string[]
  query: string
  group: string | null
}
export const emptyFilters = (): Filters => ({
  include: [],
  exclude: [],
  requirements: [],
  requirementsExclude: [],
  craftingMax: null,
  scope: "all",
  selectors: [],
  query: "",
  group: null,
})
export function cycleFilter(filters: Filters, tag: string, kind: "tag" | "requirement" = "tag"): Filters {
  const yes = kind === "tag" ? "include" : "requirements"
  const no = kind === "tag" ? "exclude" : "requirementsExclude"
  const included = filters[yes].includes(tag)
  const excluded = filters[no].includes(tag)
  const positive = filters[yes].filter((value) => value !== tag)
  const negative = filters[no].filter((value) => value !== tag)
  if (!included && !excluded) positive.push(tag)
  else if (included) negative.push(tag)
  return { ...filters, [yes]: positive, [no]: negative }
}
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : []
const validCraftingMax = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null

const parseScope = (value: unknown): RecipeSearchScope => (value === "result" || value === "ingredient" ? value : "all")

function storedFilters(raw: unknown): Filters {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    include: stringList(value.include),
    exclude: stringList(value.exclude),
    requirements: stringList(value.requirements),
    requirementsExclude: stringList(value.requirementsExclude),
    craftingMax: validCraftingMax(value.craftingMax),
    scope: parseScope(value.scope),
    selectors: stringList(value.selectors),
    query: typeof value.query === "string" ? value.query : "",
    group: typeof value.group === "string" && value.group ? value.group : null,
  }
}
export function restoreFilters(game: Game, search = ""): Filters {
  let stored = emptyFilters()
  try {
    stored = storedFilters(JSON.parse(sessionStorage.getItem(`crafting.filters.${game}`) ?? "{}"))
  } catch {
    /* unavailable storage */
  }
  const params = new URLSearchParams(search)
  const fields = [
    "view",
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
    "group",
  ]
  if (fields.some((key) => params.has(key))) {
    stored = emptyFilters()
    stored.include = (params.get("include") ?? params.get("tag") ?? "").split(",").filter(Boolean)
    stored.exclude = (params.get("exclude") ?? "").split(",").filter(Boolean)
    stored.requirements = (params.get("requirements") ?? params.get("requirement") ?? "").split(",").filter(Boolean)
    stored.requirementsExclude = (params.get("requirementsExclude") ?? "").split(",").filter(Boolean)
    stored.selectors = (params.get("selector") ?? "").split(",").filter(Boolean)
    stored.query = params.get("q") ?? ""
    stored.group = params.get("group")
    stored.scope = parseScope(params.get("as"))
    stored.craftingMax = validCraftingMax(Number(params.get("craftingMax")))
  }
  return game === "dos1" ? stored : { ...stored, requirements: [], requirementsExclude: [], craftingMax: null }
}
export function filterRecipes(recipes: RecipeRow[], filters: Filters, labels: Record<string, string>): RecipeRow[] {
  const tagMatch = (tags: string[], target: string) => tags.some((tag) => isTagWithin(tag, target))
  const categories = filters.include.filter(isCategoryTag)
  const traits = filters.include.filter((tag) => !isCategoryTag(tag))
  return recipes.filter((recipe) => {
    const tags = recipeResultTags(recipe)
    const reqs = requirementTokens(recipe.requirements).map((value) => value.toLowerCase())
    if (
      (categories.length > 0 && !categories.some((tag) => tagMatch(tags, tag))) ||
      !traits.every((tag) => tagMatch(tags, tag)) ||
      filters.exclude.some((tag) => tagMatch(tags, tag))
    )
      return false
    if (filters.requirements.length && !filters.requirements.some((value) => reqs.includes(value.toLowerCase())))
      return false
    if (filters.requirementsExclude.some((value) => reqs.includes(value.toLowerCase()))) return false
    if (filters.craftingMax !== null && !matchesCraftingMax(recipe.requirements, filters.craftingMax)) return false
    if (
      filters.scope !== "result" &&
      filters.selectors.length &&
      !filters.selectors.some((value) => recipeUsesSelector(recipe, value))
    )
      return false
    return matchesRecipeQuery(recipe, filters.query, labels, filters.scope)
  })
}
export function filterUpgrades(upgrades: RecipeUpgrade[], filters: Filters): RecipeUpgrade[] {
  const related = (a: string, b: string) => isTagWithin(a, b) || isTagWithin(b, a)
  const categories = filters.include.filter(isCategoryTag)
  const traits = filters.include.filter((tag) => !isCategoryTag(tag))
  return upgrades.filter((upgrade) => {
    const tags = [...upgrade.targetTags, ...upgrade.tags]
    if (categories.length && !categories.some((tag) => upgrade.targetTags.some((target) => related(target, tag))))
      return false
    if (!traits.every((tag) => upgrade.tags.some((own) => isTagWithin(own, tag)))) return false
    if (filters.exclude.some((tag) => tags.some((own) => isTagWithin(own, tag)))) return false
    const reqs = requirementTokens(upgrade.requirements).map((value) => value.toLowerCase())
    if (filters.requirements.length && !filters.requirements.some((value) => reqs.includes(value.toLowerCase())))
      return false
    if (filters.requirementsExclude.some((value) => reqs.includes(value.toLowerCase()))) return false
    if (filters.craftingMax !== null && !matchesCraftingMax(upgrade.requirements, filters.craftingMax)) return false
    return matchesUpgradeQuery(upgrade, filters.query)
  })
}
export function filtersToSearch(filters: Filters, view: string): string {
  const params = new URLSearchParams({ view })
  for (const field of ["include", "exclude", "requirements", "requirementsExclude"] as const) {
    if (filters[field].length) params.set(field, filters[field].join(","))
  }
  if (filters.group) params.set("group", filters.group)
  if (filters.query) params.set("q", filters.query)
  if (filters.scope !== "all") params.set("as", filters.scope)
  if (filters.selectors.length) params.set("selector", filters.selectors.join(","))
  if (filters.craftingMax !== null) params.set("craftingMax", String(filters.craftingMax))
  return params.toString()
}

/** Internal navigation carries remembered filters; explicit URL views retain reset semantics. */
export function rememberedCatalogHref(game: Game, view: View, filters = restoreFilters(game)): string {
  return `${catalogHref(game, view).split("?")[0]}?${filtersToSearch(filters, view)}`
}
