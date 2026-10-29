import type { RecipeCatalog, RecipeData } from "./recipes"
import type { ItemCraftRole, TraitGroup } from "./recipeView"

export type PageSummary = {
  slug: string
  title: string
  titlePl?: string
  tags: string[]
}
export type CatalogManifest = {
  catalogs: Record<RecipeCatalog, { recipes: number; items: number }>
  pages: PageSummary[]
  itemRoles: Record<RecipeCatalog, Record<string, ItemCraftRole>>
  traitGroups: TraitGroup[]
}
export type CatalogData = RecipeData
