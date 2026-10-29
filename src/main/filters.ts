import type { Recipe, RecipeSearchScope } from "./domain/recipe"
import { RECIPE_SORTS, type RecipeSort } from "./domain/recipeOrder"
import { SearchQuery } from "./domain/searchQuery"
import { tagHierarchy } from "./domain/tagHierarchy"
import type { TagLabels } from "./domain/tagLabels"
import type { Upgrade } from "./domain/upgrade"
import { catalogHref, type Game, type View } from "./routing"
export type Filters = {
  include: string[]
  exclude: string[]
  requirements: string[]
  requirementsExclude: string[]
  craftingMax: number | null
  scope: RecipeSearchScope
  query: string
  sort: RecipeSort
}
export const emptyFilters = (): Filters => ({
  include: [],
  exclude: [],
  requirements: [],
  requirementsExclude: [],
  craftingMax: null,
  scope: "all",
  query: "",
  sort: "default",
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
const parseSort = (value: unknown): RecipeSort =>
  RECIPE_SORTS.includes(value as RecipeSort) ? (value as RecipeSort) : "default"

function storedFilters(raw: unknown): Filters {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    include: stringList(value.include),
    exclude: stringList(value.exclude),
    requirements: stringList(value.requirements),
    requirementsExclude: stringList(value.requirementsExclude),
    craftingMax: validCraftingMax(value.craftingMax),
    scope: parseScope(value.scope),
    query: typeof value.query === "string" ? value.query : "",
    sort: parseSort(value.sort),
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
  const fields = ["view", "include", "exclude", "q", "requirements", "requirementsExclude", "craftingMax", "as", "sort"]
  if (fields.some((key) => params.has(key))) {
    stored = emptyFilters()
    stored.include = (params.get("include") ?? "").split(",").filter(Boolean)
    stored.exclude = (params.get("exclude") ?? "").split(",").filter(Boolean)
    stored.requirements = (params.get("requirements") ?? "").split(",").filter(Boolean)
    stored.requirementsExclude = (params.get("requirementsExclude") ?? "").split(",").filter(Boolean)
    stored.query = params.get("q") ?? ""
    stored.scope = parseScope(params.get("as"))
    stored.craftingMax = validCraftingMax(Number(params.get("craftingMax")))
    stored.sort = parseSort(params.get("sort"))
  }
  return game === "dos1" ? stored : { ...stored, requirements: [], requirementsExclude: [], craftingMax: null }
}
export function filterRecipes(recipes: Recipe[], filters: Filters, labels: TagLabels): Recipe[] {
  const tagMatch = (tags: string[], target: string) => tags.some((tag) => tagHierarchy.isWithin(tag, target))
  const categories = filters.include.filter((tag) => tagHierarchy.isCategory(tag))
  const traits = filters.include.filter((tag) => !tagHierarchy.isCategory(tag))
  const query = new SearchQuery(filters.query)
  return recipes.filter((recipe) => {
    const tags = recipe.resultTags()
    const reqs = new Set(recipe.requirementList.tokens().map((value) => value.toLowerCase()))
    if (
      (categories.length > 0 && !categories.some((tag) => tagMatch(tags, tag))) ||
      !traits.every((tag) => tagMatch(tags, tag)) ||
      filters.exclude.some((tag) => tagMatch(tags, tag))
    )
      return false
    if (filters.requirements.length && !filters.requirements.some((value) => reqs.has(value.toLowerCase())))
      return false
    if (filters.requirementsExclude.some((value) => reqs.has(value.toLowerCase()))) return false
    if (filters.craftingMax !== null && !recipe.requirementList.allowCraftingLevel(filters.craftingMax)) return false
    return recipe.matches(query, labels, filters.scope)
  })
}
export function filterUpgrades(upgrades: Upgrade[], filters: Filters): Upgrade[] {
  const within = (tag: string, ancestor: string) => tagHierarchy.isWithin(tag, ancestor)
  const related = (a: string, b: string) => within(a, b) || within(b, a)
  const categories = filters.include.filter((tag) => tagHierarchy.isCategory(tag))
  const traits = filters.include.filter((tag) => !tagHierarchy.isCategory(tag))
  const query = new SearchQuery(filters.query)
  return upgrades.filter((upgrade) => {
    const tags = [...upgrade.targetTags, ...upgrade.tags]
    if (categories.length && !categories.some((tag) => upgrade.targetTags.some((target) => related(target, tag))))
      return false
    if (!traits.every((tag) => upgrade.tags.some((own) => within(own, tag)))) return false
    if (filters.exclude.some((tag) => tags.some((own) => within(own, tag)))) return false
    const reqs = new Set(upgrade.requirementList.tokens().map((value) => value.toLowerCase()))
    if (filters.requirements.length && !filters.requirements.some((value) => reqs.has(value.toLowerCase())))
      return false
    if (filters.requirementsExclude.some((value) => reqs.has(value.toLowerCase()))) return false
    if (filters.craftingMax !== null && !upgrade.requirementList.allowCraftingLevel(filters.craftingMax)) return false
    return upgrade.matches(query)
  })
}
export function filtersToSearch(filters: Filters, view: string): string {
  const params = new URLSearchParams({ view })
  for (const field of ["include", "exclude", "requirements", "requirementsExclude"] as const) {
    if (filters[field].length) params.set(field, filters[field].join(","))
  }
  if (filters.query) params.set("q", filters.query)
  if (filters.scope !== "all") params.set("as", filters.scope)
  if (filters.craftingMax !== null) params.set("craftingMax", String(filters.craftingMax))
  if (filters.sort !== "default") params.set("sort", filters.sort)
  return params.toString()
}

/** Internal navigation carries remembered filters; explicit URL views retain reset semantics. */
export function rememberedCatalogHref(game: Game, view: View, filters = restoreFilters(game)): string {
  return `${catalogHref(game, view).split("?")[0]}?${filtersToSearch(filters, view)}`
}
