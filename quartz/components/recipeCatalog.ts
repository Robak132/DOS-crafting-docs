import { QuartzPluginData } from "../plugins/vfile"
import { buildRecipeData, RecipeData, RecipeCatalog } from "./recipes"
import { recipeCatalogSlug } from "./recipeView"

export const OVERHAUL_SLUG = "dos2-crafting-overhaul"
export const DOS2_SLUG = "DOS2"
const cache = new WeakMap<QuartzPluginData[], Map<RecipeCatalog, RecipeData>>()
const combinedCache = new WeakMap<QuartzPluginData[], RecipeData>()
const allCatalogsCache = new WeakMap<QuartzPluginData[], RecipeData>()

export function getCatalogData(allFiles: QuartzPluginData[], catalog: RecipeCatalog): RecipeData {
  let catalogs = cache.get(allFiles)
  if (!catalogs) {
    catalogs = new Map()
    cache.set(allFiles, catalogs)
  }
  const cached = catalogs.get(catalog)
  if (cached) return cached
  const data = buildRecipeData(allFiles, catalog)
  const labels = new Map(
    allFiles
      .filter((file) => file.frontmatter?.categoryPage === true)
      .flatMap((file) => (file.frontmatter?.tags ?? []).map((tag) => [tag, file.frontmatter?.title ?? tag] as const)),
  )
  data.tags.forEach((tag) => {
    tag.label = labels.get(tag.tag) ?? tag.label
  })
  catalogs.set(catalog, data)
  return data
}

export function isRecipePage(slug: string | undefined): boolean {
  return slug === "receptury" || slug === DOS2_SLUG || slug === OVERHAUL_SLUG
}

function mergeCatalogStats(catalogs: RecipeData[], field: "tags" | "requirements" | "selectors") {
  const stats = new Map<string, RecipeData[typeof field][number]>()
  for (const data of catalogs)
    for (const stat of data[field])
      stats.set(stat.tag, { ...stat, count: stat.count + (stats.get(stat.tag)?.count ?? 0) })
  return [...stats.values()].sort((a, b) => (a.label ?? a.tag).localeCompare(b.label ?? b.tag, "pl"))
}

function mergeCatalogs(catalogs: RecipeData[]): RecipeData {
  return {
    recipes: catalogs
      .flatMap((data) => data.recipes)
      .sort((a, b) => a.result.name.localeCompare(b.result.name, "pl")),
    tags: mergeCatalogStats(catalogs, "tags"),
    requirements: mergeCatalogStats(catalogs, "requirements"),
    selectors: mergeCatalogStats(catalogs, "selectors"),
  }
}

/** Połączone tagi/selektory ze wszystkich gier — do sidebara poza stronami katalogu. */
export function getAllCatalogsData(allFiles: QuartzPluginData[]): RecipeData {
  const cached = allCatalogsCache.get(allFiles)
  if (cached) return cached
  const data = mergeCatalogs([
    getCatalogData(allFiles, "dos1"),
    getCatalogData(allFiles, "dos2"),
    getCatalogData(allFiles, "dos2-overhaul"),
  ])
  allCatalogsCache.set(allFiles, data)
  return data
}

export function getRecipeCatalog(allFiles: QuartzPluginData[], slug?: string): RecipeData {
  if (slug === DOS2_SLUG) return getCatalogData(allFiles, "dos2")
  if (slug !== OVERHAUL_SLUG) return getCatalogData(allFiles, "dos1")
  const cached = combinedCache.get(allFiles)
  if (cached) return cached
  const data = mergeCatalogs([getCatalogData(allFiles, "dos2"), getCatalogData(allFiles, "dos2-overhaul")])
  combinedCache.set(allFiles, data)
  return data
}

export function getTagCatalogSlug(allFiles: QuartzPluginData[], tag: string, pageTags: readonly string[]): string {
  const preferred = recipeCatalogSlug(tag, pageTags)
  return (
    [preferred, DOS2_SLUG, OVERHAUL_SLUG, "receptury"].find((slug) =>
      getRecipeCatalog(allFiles, slug).tags.some((stat) => stat.tag === tag && stat.count > 0),
    ) ?? preferred
  )
}
