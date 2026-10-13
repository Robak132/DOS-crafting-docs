import type { QuartzPluginData } from "../plugins/vfile"
import { getAllCatalogsData } from "./recipeCatalog"
import type { ItemCraftRole } from "./recipeView"

export type { ItemCraftRole }

const cache = new WeakMap<QuartzPluginData[], Record<string, ItemCraftRole>>()

/**
 * Rola przedmiotu w craftingu (po slugach stron itemPage):
 * - mid: craftowalny i używany dalej jako składnik
 * - end: craftowalny, bez dalszych użyć
 * - dead: niecraftowalny i bez użyć
 * (składniki bazowe — tylko użycia, bez craftu — bez klasy)
 */
export function getItemCraftRoles(allFiles: QuartzPluginData[]): Record<string, ItemCraftRole> {
  const cached = cache.get(allFiles)
  if (cached) return cached

  const craftable = new Set<string>()
  const usable = new Set<string>()
  for (const recipe of getAllCatalogsData(allFiles).recipes) {
    if (recipe.result.slug) craftable.add(recipe.result.slug)
    for (const ingredient of recipe.ingredients) {
      if (ingredient.slug) usable.add(ingredient.slug)
    }
  }

  const roles: Record<string, ItemCraftRole> = {}
  for (const file of allFiles) {
    if (file.frontmatter?.itemPage !== true || !file.slug) continue
    const slug = file.slug
    const canCraft = craftable.has(slug)
    const canUse = usable.has(slug)
    if (canCraft && canUse) roles[slug] = "mid"
    else if (canCraft) roles[slug] = "end"
    else if (!canUse) roles[slug] = "dead"
  }

  cache.set(allFiles, roles)
  return roles
}
