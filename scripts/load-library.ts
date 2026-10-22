import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import type { LibraryPage } from "../src/main/domain/types"
import type { RecipeCatalog, RecipeItem, RecipeRow, RecipeUpgrade } from "../src/main/domain/recipes"
import type { RecipeSources } from "../src/main/domain/recipeCatalog"

const reservedSlugs = new Set(["index", "receptury", "dos2", "dos2-crafting-overhaul", "data", "assets", "404"])
const pageFiles = { DOS1: "dos1.json", DOS2: "dos2.json", "DOS2-CO": "dos2-co.json" } as const
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
}
const quantityPattern = /^x(?:\d+|\((?:\d+-\d+|\?)\))$/
function validItem(item: RecipeItem, inPool = false): boolean {
  return Boolean(
    item &&
    (item.pool === undefined ||
      (!inPool &&
        !item.slug &&
        Array.isArray(item.pool) &&
        item.pool.length > 1 &&
        item.pool.every((entry) => validItem(entry, true)))) &&
    (item.requirements === undefined || (inPool && /^(?:Crafting|Blacksmithing) [1-5]$/.test(item.requirements))) &&
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
    (item.quantity === undefined || (typeof item.quantity === "string" && quantityPattern.test(item.quantity))) &&
    (item.selectorTag === undefined || typeof item.selectorTag === "string"),
  )
}
export async function loadLibrary(directory = "data/library") {
  const pagesBySlug = new Map<string, LibraryPage>()
  const gamesBySlug = new Map<string, string[]>()
  for (const [game, name] of Object.entries(pageFiles)) {
    const filename = path.join(directory, "pages", name)
    const source: { game: string; pages: Omit<LibraryPage, "itemPage" | "categoryPage">[] } = JSON.parse(
      await fs.readFile(filename, "utf8"),
    )
    assert.equal(source.game, game, `Wrong game: ${filename}`)
    assert.ok(Array.isArray(source.pages), `Missing pages: ${filename}`)
    for (const page of source.pages) {
      const where = `${filename}: ${page?.slug}`
      assert.ok(
        typeof page.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug),
        `Invalid slug (lowercase English words joined by hyphens): ${where}`,
      )
      assert.ok(!reservedSlugs.has(page.slug), `Slug reserved for a route or asset folder: ${where}`)
      assert.ok(typeof page.title === "string" && page.title.trim(), `Missing title: ${where}`)
      assert.ok(page.titlePl === undefined || typeof page.titlePl === "string", `Invalid Polish title: ${where}`)
      assert.ok(strings(page.tags), `Invalid tags: ${where}`)
      assert.ok(page.tags.includes(game), `Page without its game tag ${game}: ${where}`)
      const previous = pagesBySlug.get(page.slug)
      if (previous) {
        const { itemPage: _item, categoryPage: _category, ...copy } = previous
        assert.deepEqual(page, copy, `Copies of a shared page differ: ${where}`)
      }
      pagesBySlug.set(page.slug, { ...page, itemPage: true, categoryPage: false })
      gamesBySlug.set(page.slug, [...(gamesBySlug.get(page.slug) ?? []), game])
    }
  }
  for (const [slug, games] of gamesBySlug) {
    const tagged = Object.keys(pageFiles).filter((game) => pagesBySlug.get(slug)!.tags.includes(game))
    assert.deepEqual(games, tagged, `Shared page must be listed in every game file it is tagged with: ${slug}`)
  }
  const pages = [...pagesBySlug.values()].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  assert.ok(pages.length > 0, "The JSON library contains no pages")
  const sources = {} as RecipeSources
  const items = {} as Record<RecipeCatalog, RecipeItem[]>
  const upgrades = {} as Record<RecipeCatalog, RecipeUpgrade[]>
  for (const game of ["dos1", "dos2", "dos2-overhaul"] as RecipeCatalog[]) {
    const filename = path.join(directory, "recipes", `${game}.json`)
    const source: { game: RecipeCatalog; recipes: RecipeRow[]; upgrades?: RecipeUpgrade[]; items?: RecipeItem[] } =
      JSON.parse(await fs.readFile(filename, "utf8"))
    assert.equal(source.game, game, `Wrong game: ${filename}`)
    assert.ok(Array.isArray(source.recipes), `Missing recipes: ${filename}`)
    assert.ok(
      source.items === undefined ||
        (Array.isArray(source.items) && source.items.every((item) => validItem(item) && !item.pool)),
      `Invalid items: ${filename}`,
    )
    items[game] = source.items ?? []
    for (const row of source.recipes) {
      assert.ok(typeof row.id === "string" && row.id.trim() && validItem(row.result), `Invalid result: ${filename}`)
      assert.ok(
        Array.isArray(row.ingredients) &&
          row.ingredients.length > 0 &&
          row.ingredients.every((item) => validItem(item) && !item.pool),
        `Invalid ingredients: ${row.id}`,
      )
      assert.ok(
        row.extraResults === undefined ||
          (Array.isArray(row.extraResults) &&
            row.extraResults.length > 0 &&
            row.extraResults.every((item) => validItem(item) && !item.pool) &&
            row.transformsIngredient === undefined),
        `Invalid extra results: ${row.id}`,
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
    upgrades[game] = source.upgrades ?? []
    assert.ok(Array.isArray(upgrades[game]), `Invalid upgrades: ${filename}`)
    for (const upgrade of upgrades[game]) {
      assert.ok(typeof upgrade.id === "string" && upgrade.id.trim(), `Invalid upgrade id: ${filename}`)
      assert.ok(
        typeof upgrade.effect?.en === "string" &&
          upgrade.effect.en.trim() &&
          (upgrade.effect.pl === undefined || typeof upgrade.effect.pl === "string"),
        `Invalid upgrade effect: ${upgrade.id}`,
      )
      assert.ok(
        validItem(upgrade.target) &&
          !upgrade.target.pool &&
          strings(upgrade.targetTags) &&
          upgrade.targetTags.length > 0 &&
          upgrade.targetTags.every((tag) => tag.startsWith("Typ/")),
        `Invalid upgrade target: ${upgrade.id}`,
      )
      assert.ok(strings(upgrade.tags), `Invalid upgrade tags: ${upgrade.id}`)
      assert.ok(
        Array.isArray(upgrade.ingredients) && upgrade.ingredients.every((item) => validItem(item) && !item.pool),
        `Invalid upgrade ingredients: ${upgrade.id}`,
      )
      for (const field of ["requirements", "notes", "remarks", "source"] as const)
        assert.equal(typeof upgrade[field], "string", `Missing ${field}: ${upgrade.id}`)
    }
  }
  return { pages, sources, items, upgrades }
}
