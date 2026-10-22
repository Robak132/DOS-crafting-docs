export type FullSlug = string
export type Game = "dos1" | "dos2" | "dos2-overhaul"
export type View = "items" | "recipes" | "upgrades"
export const games: { id: Game; slug: string; label: string }[] = [
  { id: "dos1", slug: "receptury", label: "DOS1" },
  { id: "dos2", slug: "DOS2", label: "DOS2" },
  { id: "dos2-overhaul", slug: "dos2-crafting-overhaul", label: "DOS2 – Crafting Overhaul" },
]

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
export function redirectHref(slug: string, search: string, redirects: Record<string, string> = {}): string | undefined {
  const target = redirects[slug]
  if (target === undefined) return undefined
  const [path, query] = target.split("?")
  return query === undefined ? pageHref(path) + search : `${pageHref(path)}?${query}`
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
