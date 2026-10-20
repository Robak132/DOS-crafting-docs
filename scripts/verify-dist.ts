import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import type { CatalogManifest, CatalogData } from "../src/main/domain/types"
import { isPublicPage } from "../src/main/routing"
import { loadLibrary } from "./load-library"
const manifest: CatalogManifest = JSON.parse(await fs.readFile("dist/data/manifest.json", "utf8"))
assert.ok(manifest.pages.every(isPublicPage), "Category and tag pages must not be published")
const library = await loadLibrary()
for (const page of library.pages.filter((page) => !isPublicPage(page))) {
  for (const filename of [`${page.slug}.html`, `${page.slug}/index.html`, `data/pages/${page.slug}.json`])
    await assert.rejects(fs.access(path.join("dist", filename)), `Blocked page was published: ${filename}`)
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
      .flatMap((row) => [row.result, ...row.ingredients])
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
for (const slug of ["receptury", "DOS2", "dos2-crafting-overhaul", ...manifest.pages.map((page) => page.slug)]) {
  if (slug === "index") continue
  assert.equal(await fs.readFile(path.join("dist", slug, "index.html"), "utf8"), html)
  assert.equal(await fs.readFile(path.join("dist", slug + ".html"), "utf8"), html)
}
for (const page of manifest.pages) {
  const detail = JSON.parse(await fs.readFile(path.join("dist/data/pages", page.slug + ".json"), "utf8"))
  assert.equal(detail.slug, page.slug)
  assert.ok(
    detail.tags.every((tag: string) => tag.trim().length > 0),
    `Empty tag on ${page.slug}`,
  )
  assert.ok(!/<script[\s>]/i.test(detail.html))
}
for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
  const name = path.basename(match[1])
  await fs.access(path.join("dist/assets", name))
}
console.log(
  `Artefakt GitHub Pages OK: ${manifest.pages.length} stron, ${base.recipes.length} receptur DOS2, ${combined.recipes.length} DOS2 + Overhaul; bez zależności od Quartz i Steam.`,
)
