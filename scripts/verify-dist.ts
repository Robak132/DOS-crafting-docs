import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import type { CatalogManifest, CatalogData } from "../src/main/domain/types"
import { games, isPublicPage, itemPath, pageGames } from "../src/main/routing"
import { loadLibrary } from "./load-library"
const manifest: CatalogManifest = JSON.parse(await fs.readFile("dist/data/manifest.json", "utf8"))
assert.ok(manifest.pages.every(isPublicPage), "Category and tag pages must not be published")
const library = await loadLibrary()
for (const page of library.pages.filter((page) => !isPublicPage(page))) {
  for (const game of games)
    await assert.rejects(
      fs.access(path.join("dist", `${itemPath(game.id, page.slug)}.html`)),
      `Blocked page was published: ${page.slug}`,
    )
}
const base: CatalogData = JSON.parse(await fs.readFile("dist/data/catalog-dos2.json", "utf8"))
const combined: CatalogData = JSON.parse(await fs.readFile("dist/data/catalog-dos2-overhaul.json", "utf8"))
for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
  const catalog: CatalogData = JSON.parse(await fs.readFile(`dist/data/catalog-${game}.json`, "utf8"))
  const descriptions = JSON.parse(await fs.readFile(`dist/data/descriptions-${game}.json`, "utf8"))
  assert.ok(Object.keys(descriptions).length > 0, `Missing descriptions for ${game}`)
  for (const group of Object.values(catalog.groups ?? {})) {
    assert.ok(group.members.length >= 4)
  }
  const icons = new Set(
    catalog.recipes
      .flatMap((row) => [row.result, ...(row.extraResults ?? []), ...(row.result.pool ?? []), ...row.ingredients])
      .flatMap((item) => (item.icon ? [item.icon] : [])),
  )
  assert.ok(icons.size > 0, `Missing icons for ${game}`)
  for (const icon of icons) {
    assert.match(icon, /^data\/icons\/(?:dos1|dos2|overhaul)\/[a-z0-9-]+\.webp$/)
    await fs.access(path.join("dist", icon))
  }
}
const ids = new Set(combined.recipes.flatMap((row) => row.sourceRecipeIds ?? [row.id]))
assert.ok(base.recipes.length > 0)
assert.ok(
  base.recipes.every((row) => (row.sourceRecipeIds ?? [row.id]).every((id) => ids.has(id))),
  "Overhaul must include every base DOS2 recipe",
)
const html = await fs.readFile("dist/index.html", "utf8")
assert.ok(!html.includes("quartz") && !html.includes("/src/main"))
// HTML is grouped by game: <catalog>.html and <catalog>/<item>.html for every item that game lists.
const expected = new Set([
  ...games.map((game) => `${game.slug}.html`),
  ...manifest.pages
    .filter((page) => page.itemPage)
    .flatMap((page) => pageGames(page.tags).map((game) => `${itemPath(game, page.slug)}.html`)),
])
for (const file of expected) assert.equal(await fs.readFile(path.join("dist", file), "utf8"), html, file)
const published = [
  ...(await fs.readdir("dist")).filter((name) => name.endsWith(".html") && !["index.html", "404.html"].includes(name)),
  ...(
    await Promise.all(
      games.map(async (game) => (await fs.readdir(path.join("dist", game.slug))).map((name) => `${game.slug}/${name}`)),
    )
  ).flat(),
]
assert.deepEqual(
  published.filter((file) => !expected.has(file)),
  [],
  "HTML outside its game folder",
)
assert.equal(await fs.readFile("dist/404.html", "utf8"), html)
const folders = (await fs.readdir("dist", { withFileTypes: true })).filter((entry) => entry.isDirectory())
assert.deepEqual(
  folders.map((entry) => entry.name).sort(),
  ["assets", "data", ...games.map((game) => game.slug)].sort(),
)
await assert.rejects(fs.access("dist/data/pages"), /ENOENT/)
for (const page of manifest.pages)
  assert.ok(
    page.tags.every((tag: string) => tag.trim().length > 0),
    `Empty tag on ${page.slug}`,
  )
for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
  const name = path.basename(match[1])
  await fs.access(path.join("dist/assets", name))
}
console.log(
  `Artefakt GitHub Pages OK: ${manifest.pages.length} stron, ${base.recipes.length} receptur DOS2, ${combined.recipes.length} DOS2 + Overhaul; bez zależności od Quartz i Steam.`,
)
