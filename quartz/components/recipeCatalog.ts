import { QuartzPluginData } from "../plugins/vfile"
import { buildRecipeData, RecipeData, RecipeCatalog } from "./recipes"
import { recipeCatalogSlug } from "./recipeView"

export const OVERHAUL_SLUG = "dos2-crafting-overhaul"
const cache = new WeakMap<QuartzPluginData[], Map<RecipeCatalog, RecipeData>>()

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
  return slug === "receptury" || slug === OVERHAUL_SLUG
}

export function getRecipeCatalog(allFiles: QuartzPluginData[], slug?: string): RecipeData {
  return getCatalogData(allFiles, slug === OVERHAUL_SLUG ? "dos2-overhaul" : "dos1")
}

export function getTagCatalogSlug(allFiles: QuartzPluginData[], tag: string, pageTags: readonly string[]): string {
  const preferred = recipeCatalogSlug(tag, pageTags)
  const other = preferred === OVERHAUL_SLUG ? "receptury" : OVERHAUL_SLUG
  return (
    [preferred, other].find((slug) =>
      getRecipeCatalog(allFiles, slug).tags.some((stat) => stat.tag === tag && stat.count > 0),
    ) ?? preferred
  )
}
