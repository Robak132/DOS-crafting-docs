import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import type { CatalogManifest, CatalogData } from "../src/main/domain/types"
import { games, itemPath, pageGames } from "../src/main/routing"
import { GroupMatcher } from "../src/main/domain/groupMatcher"
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, "utf8"))
const [manifest, base, combined]: [CatalogManifest, CatalogData, CatalogData] = await Promise.all([
  readJson("dist/data/manifest.json"),
  readJson("dist/data/catalog-dos2.json"),
  readJson("dist/data/catalog-dos2-overhaul.json"),
])
/** One game's catalog: its descriptions, groups and every icon it links to. */
async function verifyCatalog(game: string) {
  const [catalog, descriptions]: [CatalogData, object] = await Promise.all([
    readJson(`dist/data/catalog-${game}.json`),
    readJson(`dist/data/descriptions-${game}.json`),
  ])
  assert.ok(Object.keys(descriptions).length > 0, `Missing descriptions for ${game}`)
  // Small groups stay only when the game defines them or an upgrade applies to them.
  const upgradeGroups = new Set(
    (catalog.upgrades ?? []).flatMap((upgrade) => (upgrade.targets ?? []).map((t) => t.groupId)),
  )
  for (const [id, group] of Object.entries(catalog.groups ?? {})) {
    assert.ok(
      group.members.length >= 4 || GroupMatcher.isGameGroup(group.name) || upgradeGroups.has(id),
      `Small group: ${id}`,
    )
  }
  const icons = new Set(
    catalog.recipes
      .flatMap((row) => [row.result, ...(row.extraResults ?? []), ...(row.result.pool ?? []), ...row.ingredients])
      .flatMap((item) => (item.icon ? [item.icon] : [])),
  )
  assert.ok(icons.size > 0, `Missing icons for ${game}`)
  for (const icon of icons) assert.match(icon, /^data\/icons\/(?:dos1|dos2|overhaul)\/[a-z0-9-]+\.webp$/)
  await Promise.all([...icons].map((icon) => fs.access(path.join("dist", icon))))
}
await Promise.all(["dos1", "dos2", "dos2-overhaul"].map(verifyCatalog))
const ids = new Set(combined.recipes.flatMap((row) => row.sourceRecipeIds ?? [row.id]))
assert.ok(base.recipes.length > 0)
assert.ok(
  base.recipes.every((row) => (row.sourceRecipeIds ?? [row.id]).every((id) => ids.has(id))),
  "Overhaul must include every base DOS2 recipe",
)
const html = await fs.readFile("dist/index.html", "utf8")
assert.ok(!html.includes("/src/main"))
// HTML is grouped by game: <catalog>.html and <catalog>/<item>.html for every item that game lists.
const expected = new Set([
  ...games.map((game) => `${game.slug}.html`),
  ...manifest.pages.flatMap((page) => pageGames(page.tags).map((game) => `${itemPath(game, page.slug)}.html`)),
])
const pagesHtml = await Promise.all([...expected].map((file) => fs.readFile(path.join("dist", file), "utf8")))
for (const [index, file] of [...expected].entries()) assert.equal(pagesHtml[index], html, file)
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
  folders.map((entry) => entry.name).sort((a, b) => a.localeCompare(b)),
  ["assets", "data", ...games.map((game) => game.slug)].sort((a, b) => a.localeCompare(b)),
)
await assert.rejects(fs.access("dist/data/pages"), /ENOENT/)
for (const page of manifest.pages)
  assert.ok(
    page.tags.every((tag: string) => tag.trim().length > 0),
    `Empty tag on ${page.slug}`,
  )
await Promise.all(
  [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) =>
    fs.access(path.join("dist/assets", path.basename(match[1]))),
  ),
)
console.log(
  `Artefakt GitHub Pages OK: ${manifest.pages.length} stron, ${base.recipes.length} receptur DOS2, ${combined.recipes.length} DOS2 + Overhaul.`,
)
