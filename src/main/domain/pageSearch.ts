import type { RecipeItem } from "./recipes"
import type { PageSummary } from "./types"
import { normalizeSearch } from "./recipeView"

/** The active catalog supplies both membership and names; the global manifest only supplies routes. */
export function searchCatalogPages(
  pages: PageSummary[],
  items: ReadonlyMap<string, Pick<RecipeItem, "name" | "namePl">>,
  query: string,
  limit = 10,
): PageSummary[] {
  const term = normalizeSearch(query.trim())
  if (!term) return []
  return pages
    .filter((page) => {
      const item = items.get(page.slug)
      return Boolean(
        page.itemPage &&
        !page.categoryPage &&
        item &&
        normalizeSearch(`${item.name} ${item.namePl ?? ""}`).includes(term),
      )
    })
    .slice(0, limit)
}
