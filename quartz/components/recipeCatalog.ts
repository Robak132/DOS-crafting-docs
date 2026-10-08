import { QuartzPluginData } from "../plugins/vfile"
import { buildRecipeData, RecipeData, RecipeCatalog } from "./recipes"
import { recipeCatalogSlug } from "./recipeView"

export const OVERHAUL_SLUG = "dos2-crafting-overhaul"
export const DOS2_SLUG = "DOS2"
const cache = new WeakMap<QuartzPluginData[], Map<RecipeCatalog, RecipeData>>()
const combinedCache = new WeakMap<QuartzPluginData[], RecipeData>()

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

export function getRecipeCatalog(allFiles: QuartzPluginData[], slug?: string): RecipeData {
  if (slug === DOS2_SLUG) return getCatalogData(allFiles, "dos2")
  if (slug !== OVERHAUL_SLUG) return getCatalogData(allFiles, "dos1")
  const cached = combinedCache.get(allFiles)
  if (cached) return cached
  const base = getCatalogData(allFiles, "dos2")
  const overhaul = getCatalogData(allFiles, "dos2-overhaul")
  const combine = (field: "tags" | "requirements") => {
    const stats = new Map<string, RecipeData[typeof field][number]>()
    for (const data of [base, overhaul])
      for (const stat of data[field])
        stats.set(stat.tag, { ...stat, count: stat.count + (stats.get(stat.tag)?.count ?? 0) })
    return [...stats.values()]
  }
  const data = {
    recipes: [...base.recipes, ...overhaul.recipes].sort((a, b) => a.result.name.localeCompare(b.result.name, "pl")),
    tags: combine("tags"),
    requirements: combine("requirements"),
  }
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
