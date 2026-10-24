export type FullSlug = string
export type Game = "dos1" | "dos2" | "dos2-overhaul"
export type View = "items" | "recipes" | "upgrades"
export const games: { id: Game; slug: string; label: string; title: string }[] = [
  { id: "dos1", slug: "receptury", label: "DOS1", title: "Divinity: Original Sin – Enhanced Edition" },
  { id: "dos2", slug: "DOS2", label: "DOS2", title: "Divinity: Original Sin 2 – Definitive Edition" },
  {
    id: "dos2-overhaul",
    slug: "dos2-crafting-overhaul",
    label: "DOS2 – Crafting Overhaul",
    title: "Divinity: Original Sin 2 – mod Crafting Overhaul",
  },
]
/** Whether the address names a game: its catalog or an item page under it. */
export function routeNamesGame(slug: string): boolean {
  return Boolean(gameForSlug(slug) || parseItemRoute(slug))
}

const appBase = import.meta.env?.BASE_URL ?? "/"
export function pageHref(slug: string): string {
  return appBase + slug.split("/").map(encodeURIComponent).join("/")
}
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
      .split("/")
      .map((segment) => {
        try {
          return decodeURIComponent(segment)
        } catch {
          return segment
        }
      })
      .join("/")
  }
}
export function routeSlug(pathname: string, base = appBase): string {
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "")
  return safeDecode(relative)
    .replace(/\/?index\.html$/, "")
    .replace(/\.html$/, "")
    .replace(/\/$/, "")
}
/** An item page lives under the catalog of its game: `<catalog>/<item>`. */
export function itemPath(game: Game, slug: string): string {
  return `${games.find((entry) => entry.id === game)!.slug}/${slug}`
}
export function itemHref(game: Game, slug: string): string {
  return pageHref(itemPath(game, slug))
}
export function parseItemRoute(slug: string): { game: Game; item: string } | undefined {
  const [catalog, item, ...rest] = slug.split("/")
  const game = gameForSlug(catalog)
  return game && item && rest.length === 0 ? { game, item } : undefined
}
/** Games whose catalog lists a page; Overhaul also contains every base DOS2 item. */
export function pageGames(tags: string[]): Game[] {
  return games
    .filter(({ id }) =>
      id === "dos1"
        ? tags.includes("DOS1")
        : id === "dos2"
          ? tags.includes("DOS2")
          : tags.some((tag) => tag === "DOS2" || tag === "DOS2-CO"),
    )
    .map(({ id }) => id)
}
export function gameForSlug(slug: string): Game | undefined {
  return games.find((game) => game.slug === slug)?.id
}
export function isPublicPage(page: { slug: string; itemPage: boolean; categoryPage: boolean }): boolean {
  return !page.categoryPage && (page.itemPage || page.slug === "index" || Boolean(gameForSlug(page.slug)))
}
export function catalogHref(game: Game, view: View): string {
  return `${pageHref(games.find((entry) => entry.id === game)!.slug)}?view=${view}`
}
