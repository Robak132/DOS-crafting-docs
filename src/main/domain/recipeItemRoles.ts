import type { PageSummary } from "./types"
import type { RecipeRow } from "./recipes"
import type { ItemCraftRole } from "./recipeView"

export type { ItemCraftRole }

/**
 * Rola przedmiotu w craftingu (po slugach stron itemPage):
 * - mid: craftowalny i używany dalej jako składnik
 * - end: craftowalny, bez dalszych użyć
 * - dead: niecraftowalny i bez użyć
 * (składniki bazowe — tylko użycia, bez craftu — bez klasy)
 */
export function getItemCraftRoles(pages: PageSummary[], recipes: RecipeRow[]): Record<string, ItemCraftRole> {
  const craftable = new Set<string>()
  const usable = new Set<string>()
  for (const recipe of recipes) {
    if (recipe.result.slug) craftable.add(recipe.result.slug)
    for (const ingredient of recipe.ingredients) {
      if (ingredient.slug) usable.add(ingredient.slug)
    }
  }

  const roles: Record<string, ItemCraftRole> = {}
  for (const page of pages) {
    if (!page.itemPage) continue
    const slug = page.slug
    const canCraft = craftable.has(slug)
    const canUse = usable.has(slug)
    if (canCraft && canUse) roles[slug] = "mid"
    else if (canCraft) roles[slug] = "end"
    else if (!canUse) roles[slug] = "dead"
  }

  return roles
}
