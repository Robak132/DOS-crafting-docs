import { QuartzPluginData } from "../plugins/vfile"
import { buildRecipeData, RecipeData, RecipeCatalog } from "./recipes"

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
