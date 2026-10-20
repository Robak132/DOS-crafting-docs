import type { RecipeItem } from "./recipes"
import type { PageSummary } from "./types"

/** The active catalog supplies both membership and names; the global manifest only supplies routes. */
export function searchCatalogPages(
  pages: PageSummary[],
  items: ReadonlyMap<string, Pick<RecipeItem, "name" | "namePl">>,
  query: string,
  limit = 10,
): PageSummary[] {
  const term = query.trim().toLocaleLowerCase()
  if (!term) return []
  return pages
    .filter((page) => {
      const item = items.get(page.slug)
      return Boolean(
        page.itemPage &&
        !page.categoryPage &&
        item &&
        `${item.name} ${item.namePl ?? ""}`.toLocaleLowerCase().includes(term),
      )
    })
    .slice(0, limit)
}
