export type FullSlug = string
export type FilePath = string
export type Game = "dos1" | "dos2" | "dos2-overhaul"
export type View = "items" | "recipes"
export const games: { id: Game; slug: string; label: string }[] = [
  { id: "dos1", slug: "receptury", label: "DOS1" },
  { id: "dos2", slug: "DOS2", label: "DOS2" },
  { id: "dos2-overhaul", slug: "dos2-crafting-overhaul", label: "DOS2 – Crafting Overhaul" },
]

export function slugify(value: string): string {
  return value
    .replace(/\.(md|html)$/, "")
    .split("/")
    .map((part) =>
      part
        .replaceAll("ł", "l")
        .replaceAll("Ł", "L")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s/g, "-")
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/[?#]/g, ""),
    )
    .join("/")
    .replace(/_index$/, "index")
    .replace(/^\/+|\/+$/g, "")
}
export function slugTag(value: string): string {
  return slugify(value)
}

const appBase = import.meta.env?.BASE_URL ?? "/"
export function pageHref(slug: string): string {
  return appBase + slug.split("/").map(encodeURIComponent).join("/")
}
export function resolveRelative(_current: string, target: string): string {
  return pageHref(target)
}
export function routeSlug(pathname: string, base = appBase): string {
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, "")
  return decodeURIComponent(relative)
    .replace(/\/?index\.html$/, "")
    .replace(/\.html$/, "")
    .replace(/\/$/, "")
}
export function gameForSlug(slug: string): Game | undefined {
  return games.find((game) => game.slug === slug)?.id
}
export function catalogHref(game: Game, view: View): string {
  return `${pageHref(games.find((entry) => entry.id === game)!.slug)}?view=${view}`
}
