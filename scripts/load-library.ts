import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import type { LibraryPage } from "../src/main/domain/types"
import type { RecipeCatalog, RecipeItem, RecipeRow } from "../src/main/domain/recipes"
import type { RecipeSources } from "../src/main/domain/recipeCatalog"

async function jsonFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  return (
    await Promise.all(
      entries.map((entry) => {
        const file = path.join(directory, entry.name)
        return entry.isDirectory() ? jsonFiles(file) : Promise.resolve(entry.name.endsWith(".json") ? [file] : [])
      }),
    )
  )
    .flat()
    .sort()
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
}
function validItem(item: RecipeItem): boolean {
  return Boolean(
    item &&
    typeof item.name === "string" &&
    item.name.trim() &&
    strings(item.tags) &&
    (item.slug === undefined || typeof item.slug === "string") &&
    (item.namePl === undefined || typeof item.namePl === "string") &&
    (item.quantity === undefined || typeof item.quantity === "string") &&
    (item.selectorTag === undefined || typeof item.selectorTag === "string"),
  )
}
export async function loadLibrary(directory = "data/library") {
  const pages = await Promise.all(
    (await jsonFiles(path.join(directory, "pages"))).map(async (filename) => {
      const page: Omit<LibraryPage, "html"> & { html?: string } = JSON.parse(await fs.readFile(filename, "utf8"))
      const expected = path
        .relative(path.join(directory, "pages"), filename)
        .replaceAll(path.sep, "/")
        .replace(/\.json$/, "")
      assert.equal(page.slug, expected, `Page slug must match its path: ${filename}`)
      assert.ok(
        page.slug && !page.slug.split("/").some((part) => !part || part === "." || part === ".."),
        `Invalid slug: ${filename}`,
      )
      assert.ok(typeof page.title === "string" && page.title.trim(), `Missing title: ${filename}`)
      assert.ok(page.titlePl === undefined || typeof page.titlePl === "string", `Invalid Polish title: ${filename}`)
      assert.ok(strings(page.tags) && strings(page.aliases), `Invalid tags/aliases: ${filename}`)
      assert.ok(
        (typeof page.html === "string" ||
          (page.html === undefined &&
            (page.itemPage || ["index", "DOS2", "dos2-crafting-overhaul"].includes(page.slug)))) &&
          typeof page.itemPage === "boolean" &&
          typeof page.categoryPage === "boolean",
        `Invalid page: ${filename}`,
      )
      for (const alias of page.aliases) {
        assert.ok(
          !alias.startsWith("/") && !alias.split("/").some((part) => !part || part === "." || part === ".."),
          `Invalid alias: ${filename}`,
        )
      }
      return { ...page, html: page.html ?? "" }
    }),
  )
  assert.ok(pages.length > 0, "The JSON library contains no pages")
  const sources = {} as RecipeSources
  for (const game of ["dos1", "dos2", "dos2-overhaul"] as RecipeCatalog[]) {
    const filename = path.join(directory, "recipes", `${game}.json`)
    const source: { game: RecipeCatalog; recipes: RecipeRow[] } = JSON.parse(await fs.readFile(filename, "utf8"))
    assert.equal(source.game, game, `Wrong game: ${filename}`)
    assert.ok(Array.isArray(source.recipes), `Missing recipes: ${filename}`)
    for (const row of source.recipes) {
      assert.ok(typeof row.id === "string" && row.id.trim() && validItem(row.result), `Invalid result: ${filename}`)
      assert.ok(
        Array.isArray(row.ingredients) && row.ingredients.length > 0 && row.ingredients.every(validItem),
        `Invalid ingredients: ${row.id}`,
      )
      assert.ok(strings(row.tags), `Invalid recipe tags: ${row.id}`)
      for (const field of ["requirements", "notes", "remarks", "source"] as const)
        assert.equal(typeof row[field], "string", `Missing ${field}: ${row.id}`)
    }
    sources[game] = source.recipes
  }
  return { pages, sources }
}
