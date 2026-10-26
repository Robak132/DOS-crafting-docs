import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import type { PageSummary } from "../src/main/domain/types"
import type { RecipeCatalog, RecipeItem, RecipeRow, RecipeUpgrade } from "../src/main/domain/recipes"
import type { RecipeSources } from "../src/main/domain/recipeCatalog"
import { isCategoryTag } from "../src/main/domain/tagTree"

const reservedSlugs = new Set(["index", "receptury", "dos2", "dos2-crafting-overhaul", "data", "assets", "404"])
const pageFiles = { DOS1: "dos1.json", DOS2: "dos2.json", "DOS2-CO": "dos2-co.json" } as const
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
}
const quantityPattern = /^x(?:\d+|\((?:\d+-\d+|\?)\))$/
/** A name qualifier from the JSON: an English text, optionally a Polish one (null is invalid). */
function validQualifier(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false
  const { en, pl } = value as { en?: unknown; pl?: unknown }
  const text = (entry: unknown) => typeof entry === "string" && entry.trim().length > 0
  return text(en) && (pl === undefined || text(pl))
}
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
    (item.nameQualifier === undefined || validQualifier(item.nameQualifier)) &&
    (item.slug === undefined || typeof item.slug === "string") &&
    (item.namePl === undefined || typeof item.namePl === "string") &&
    (item.quantity === undefined || (typeof item.quantity === "string" && quantityPattern.test(item.quantity))) &&
    (item.selectorTag === undefined || typeof item.selectorTag === "string"),
  )
}
const compareSlugs = (a: PageSummary, b: PageSummary) => Number(a.slug > b.slug) - Number(a.slug < b.slug)

/** Item pages of every game file; a page shared by several games must be identical in each. */
async function loadPages(directory: string): Promise<PageSummary[]> {
  const pagesBySlug = new Map<string, PageSummary>()
  const gamesBySlug = new Map<string, string[]>()
  for (const [game, name] of Object.entries(pageFiles)) {
    const filename = path.join(directory, "pages", name)
    const source: { game: string; pages: Omit<PageSummary, "itemPage" | "categoryPage">[] } = JSON.parse(
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
        const copy: Partial<PageSummary> = { ...previous }
        delete copy.itemPage
        delete copy.categoryPage
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
  const pages = [...pagesBySlug.values()].sort(compareSlugs)
  assert.ok(pages.length > 0, "The JSON library contains no pages")
  return pages
}

/** Checks one source recipe's shape. */
function checkRecipe(row: RecipeRow, filename: string) {
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

/** Checks one upgrade's shape. */
function checkUpgrade(upgrade: RecipeUpgrade, filename: string) {
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
      upgrade.targetTags.every((tag) => tag !== "Category" && isCategoryTag(tag)),
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

export async function loadLibrary(directory = "data/library") {
  const pages = await loadPages(directory)
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
    for (const row of source.recipes) checkRecipe(row, filename)
    sources[game] = source.recipes
    upgrades[game] = source.upgrades ?? []
    assert.ok(Array.isArray(upgrades[game]), `Invalid upgrades: ${filename}`)
    for (const upgrade of upgrades[game]) checkUpgrade(upgrade, filename)
  }
  return { pages, sources, items, upgrades }
}
