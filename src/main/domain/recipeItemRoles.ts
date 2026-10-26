import type { PageSummary } from "./types"
import type { RecipeCatalog, RecipeItem, RecipeRow } from "./recipes"
import type { ItemCraftRole } from "./recipeView"
import { recipeResults } from "./recipeResults"

export type { ItemCraftRole }

/**
 * Rola przedmiotu w craftingu (po slugach stron itemPage):
 * - mid: craftowalny i używany dalej jako składnik
 * - end: craftowalny, bez dalszych użyć
 * - dead: niecraftowalny i bez użyć
 * (składniki bazowe — tylko użycia, bez craftu — bez klasy)
 */
export function getItemCraftRoles(pages: PageSummary[], recipes: RecipeRow[]): Record<string, ItemCraftRole> {
  const slugs = (items: RecipeItem[]) => new Set(items.flatMap((item) => (item.slug ? [item.slug] : [])))
  const craftable = slugs(recipes.flatMap((recipe) => recipe.result.pool ?? recipeResults(recipe)))
  const usable = slugs(recipes.flatMap((recipe) => recipe.ingredients))

  const roles: Record<string, ItemCraftRole> = {}
  for (const page of pages) {
    const role = page.itemPage ? craftRole(craftable.has(page.slug), usable.has(page.slug)) : undefined
    if (role) roles[page.slug] = role
  }
  return roles
}

function craftRole(canCraft: boolean, canUse: boolean): ItemCraftRole | undefined {
  if (canCraft) return canUse ? "mid" : "end"
  return canUse ? undefined : "dead"
}

export function getCatalogItemRoles(
  pages: PageSummary[],
  catalogs: Record<RecipeCatalog, { recipes: RecipeRow[] }>,
): Record<RecipeCatalog, Record<string, ItemCraftRole>> {
  return {
    dos1: getItemCraftRoles(pages, catalogs.dos1.recipes),
    dos2: getItemCraftRoles(pages, catalogs.dos2.recipes),
    "dos2-overhaul": getItemCraftRoles(pages, catalogs["dos2-overhaul"].recipes),
  }
}
