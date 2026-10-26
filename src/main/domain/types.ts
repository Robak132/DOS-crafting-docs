import type { RecipeCatalog, RecipeData } from "./recipes"
import type { ItemCraftRole, CechyGroupMeta } from "./recipeView"

export type PageSummary = {
  slug: string
  title: string
  titlePl?: string
  tags: string[]
  itemPage: boolean
  categoryPage: boolean
}
export type CatalogManifest = {
  catalogs: Record<RecipeCatalog, { recipes: number; items: number }>
  pages: PageSummary[]
  itemRoles: Record<RecipeCatalog, Record<string, ItemCraftRole>>
  traitGroups: CechyGroupMeta[]
}
export type CatalogData = RecipeData
