import type { Game } from "./game"
import type { Item } from "./item"
import type { Recipe } from "./recipe"
import type { PageSummary } from "./types"

/** dead = szary, mid = zielony, end = fioletowy. */
export type ItemCraftRole = "dead" | "mid" | "end"

/**
 * Rola przedmiotu w craftingu (po slugach stron przedmiotów):
 * - mid: craftowalny i używany dalej jako składnik
 * - end: craftowalny, bez dalszych użyć
 * - dead: niecraftowalny i bez użyć
 * (składniki bazowe — tylko użycia, bez craftu — bez klasy)
 */
export class CraftRoles {
  private readonly craftable: Set<string>
  private readonly usable: Set<string>

  constructor(recipes: Recipe[]) {
    const slugs = (items: Item[]) => new Set(items.flatMap((item) => (item.slug ? [item.slug] : [])))
    this.craftable = slugs(recipes.flatMap((recipe) => recipe.obtainableItems()))
    this.usable = slugs(recipes.flatMap((recipe) => recipe.ingredients))
  }

  /** The roles of every page's item in each game's catalog. */
  static ofCatalogs(
    pages: PageSummary[],
    catalogs: Record<Game, { recipes: Recipe[] }>,
  ): Record<Game, Record<string, ItemCraftRole>> {
    return {
      dos1: new CraftRoles(catalogs.dos1.recipes).ofPages(pages),
      dos2: new CraftRoles(catalogs.dos2.recipes).ofPages(pages),
      "dos2-overhaul": new CraftRoles(catalogs["dos2-overhaul"].recipes).ofPages(pages),
    }
  }

  /** The CSS class of a role; "" without one. */
  static cssClass(role: ItemCraftRole | undefined): string {
    return role ? `item-craft-${role}` : ""
  }

  /** The role of each page's item, for the pages that have one. */
  ofPages(pages: PageSummary[]): Record<string, ItemCraftRole> {
    const roles: Record<string, ItemCraftRole> = {}
    for (const page of pages) {
      const role = this.role(page.slug)
      if (role) roles[page.slug] = role
    }
    return roles
  }

  role(slug: string): ItemCraftRole | undefined {
    const canUse = this.usable.has(slug)
    if (this.craftable.has(slug)) return canUse ? "mid" : "end"
    return canUse ? undefined : "dead"
  }
}
