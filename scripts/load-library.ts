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
    (item.craftingCategories === undefined || strings(item.craftingCategories)) &&
    (item.statsId === undefined || (typeof item.statsId === "string" && item.statsId.trim().length > 0)) &&
    (item.nameQualifier === undefined ||
      (item.nameQualifier !== null &&
        typeof item.nameQualifier.en === "string" &&
        item.nameQualifier.en.trim().length > 0 &&
        (item.nameQualifier.pl === undefined ||
          (typeof item.nameQualifier.pl === "string" && item.nameQualifier.pl.trim().length > 0)))) &&
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
      assert.ok(strings(page.tags), `Invalid tags: ${filename}`)
      assert.ok(
        (typeof page.html === "string" ||
          (page.html === undefined &&
            (page.itemPage || ["index", "DOS2", "dos2-crafting-overhaul"].includes(page.slug)))) &&
          typeof page.itemPage === "boolean" &&
          typeof page.categoryPage === "boolean",
        `Invalid page: ${filename}`,
      )
      return { ...page, html: page.html ?? "" }
    }),
  )
  assert.ok(pages.length > 0, "The JSON library contains no pages")
  const sources = {} as RecipeSources
  const items = {} as Record<RecipeCatalog, RecipeItem[]>
  for (const game of ["dos1", "dos2", "dos2-overhaul"] as RecipeCatalog[]) {
    const filename = path.join(directory, "recipes", `${game}.json`)
    const source: { game: RecipeCatalog; recipes: RecipeRow[]; items?: RecipeItem[] } = JSON.parse(
      await fs.readFile(filename, "utf8"),
    )
    assert.equal(source.game, game, `Wrong game: ${filename}`)
    assert.ok(Array.isArray(source.recipes), `Missing recipes: ${filename}`)
    assert.ok(
      source.items === undefined || (Array.isArray(source.items) && source.items.every(validItem)),
      `Invalid items: ${filename}`,
    )
    items[game] = source.items ?? []
    for (const row of source.recipes) {
      assert.ok(typeof row.id === "string" && row.id.trim() && validItem(row.result), `Invalid result: ${filename}`)
      assert.ok(
        Array.isArray(row.ingredients) && row.ingredients.length > 0 && row.ingredients.every(validItem),
        `Invalid ingredients: ${row.id}`,
      )
      assert.ok(
        row.transformsIngredient === undefined ||
          (Number.isInteger(row.transformsIngredient) &&
            row.transformsIngredient >= 0 &&
            row.transformsIngredient < row.ingredients.length &&
            row.notes.trim().length > 0),
        `Invalid transformed ingredient: ${row.id}`,
      )
      assert.ok(strings(row.tags), `Invalid recipe tags: ${row.id}`)
      for (const field of ["requirements", "notes", "remarks", "source"] as const)
        assert.equal(typeof row[field], "string", `Missing ${field}: ${row.id}`)
    }
    sources[game] = source.recipes
  }
  return { pages, sources, items }
}
