import type { ItemCraftRole } from "./craftRoles"
import type { Game } from "./game"
import type { TraitGroup } from "./tagSidebar"

/** An item page: its address under each game's catalog, title and tags. */
export type PageSummary = {
  slug: string
  title: string
  titlePl?: string
  tags: string[]
}

/** What data/manifest.json says about the whole site. */
export type CatalogManifest = {
  catalogs: Record<Game, { recipes: number; items: number }>
  pages: PageSummary[]
  itemRoles: Record<Game, Record<string, ItemCraftRole>>
  traitGroups: TraitGroup[]
}

export { type CatalogData } from "./catalog"
