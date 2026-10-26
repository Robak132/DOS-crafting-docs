import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { loadLibrary } from "../../scripts/load-library"
import { expandSmallGroups } from "../main/domain/itemGroups"
import { recipeResults } from "../main/domain/recipeResults"
import { assignDataKeys } from "../main/domain/itemIcons"

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dos-json-library-"))
  await fs.mkdir(path.join(directory, "pages"))
  await fs.mkdir(path.join(directory, "recipes"))
  const page = {
    slug: "item",
    title: "An item",
    titlePl: "Przedmiot",
    tags: ["DOS2", "Materialy"],
  }
  const recipe = {
    id: "craft-item",
    result: { name: "An item", slug: "item", tags: [] },
    ingredients: [{ name: "Ingredient", tags: [], quantity: "x2" }],
    tags: [],
    requirements: "",
    notes: "Effect",
    remarks: "Instruction",
    source: "Spreadsheet A1",
  }
  const writePages = async (pages: Record<string, object[]>) => {
    for (const [game, name] of [
      ["DOS1", "dos1"],
      ["DOS2", "dos2"],
      ["DOS2-CO", "dos2-co"],
    ])
      await fs.writeFile(path.join(directory, `pages/${name}.json`), JSON.stringify({ game, pages: pages[game] ?? [] }))
  }
  await writePages({ DOS2: [page] })
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    await fs.writeFile(
      path.join(directory, "recipes", `${game}.json`),
      JSON.stringify({ game, recipes: game === "dos2" ? [recipe] : [] }),
    )
  }
  return { directory, page, recipe, writePages }
}

test("JSON library reads structured recipes and item pages from one file per game", async () => {
  const { directory, page, recipe, writePages } = await fixture()
  try {
    const library = await loadLibrary(directory)
    assert.deepEqual(library.pages, [{ ...page, itemPage: true, categoryPage: false }])
    assert.deepEqual(library.sources.dos2, [recipe])
    assert.deepEqual(library.sources["dos2-overhaul"], [])
    await writePages({ DOS2: [{ ...page, title: "Renamed" }] })
    assert.equal((await loadLibrary(directory)).pages[0].title, "Renamed")
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("JSON source rejects empty tags, wrong game files and pages without their game tag", async () => {
  const { directory, page, writePages } = await fixture()
  try {
    await writePages({ DOS2: [{ ...page, tags: [""] }] })
    await assert.rejects(loadLibrary(directory), /Invalid tags/)
    await writePages({ DOS1: [page] })
    await assert.rejects(loadLibrary(directory), /without its game tag DOS1/)
    await writePages({ DOS2: [page] })
    await fs.writeFile(path.join(directory, "pages/dos2.json"), JSON.stringify({ game: "DOS1", pages: [page] }))
    await assert.rejects(loadLibrary(directory), /Wrong game/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("a page shared by several games is listed identically in each of their files", async () => {
  const { directory, page, writePages } = await fixture()
  const shared = { ...page, tags: ["DOS1", "DOS2", "Materialy"] }
  try {
    await writePages({ DOS1: [shared], DOS2: [shared] })
    const library = await loadLibrary(directory)
    assert.deepEqual(library.pages, [{ ...shared, itemPage: true, categoryPage: false }])
    await writePages({ DOS1: [shared], DOS2: [{ ...shared, titlePl: "Inny" }] })
    await assert.rejects(loadLibrary(directory), /Copies of a shared page differ/)
    await writePages({ DOS2: [shared] })
    await assert.rejects(loadLibrary(directory), /listed in every game file/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("page slugs are lowercase English words joined by hyphens and never shadow app routes", async () => {
  const { directory, page, writePages } = await fixture()
  try {
    for (const slug of [
      "Skladniki/apple",
      "Apple",
      "apple_pie",
      "-apple",
      "apple-",
      "a--b",
      "cutting-tool>",
      "jabłko",
    ]) {
      await writePages({ DOS2: [{ ...page, slug }] })
      await assert.rejects(loadLibrary(directory), /Invalid slug/, slug)
    }
    for (const slug of ["receptury", "dos2", "data", "assets"]) {
      await writePages({ DOS2: [{ ...page, slug }] })
      await assert.rejects(loadLibrary(directory), /reserved/, slug)
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("JSON source rejects malformed recipes and wrong game files", async () => {
  const { directory, recipe } = await fixture()
  try {
    const filename = path.join(directory, "recipes/dos2.json")
    await fs.writeFile(filename, JSON.stringify({ game: "dos2", recipes: [{ ...recipe, ingredients: [] }] }))
    await assert.rejects(loadLibrary(directory), /Invalid ingredients/)
    await fs.writeFile(filename, JSON.stringify({ game: "dos1", recipes: [recipe] }))
    await assert.rejects(loadLibrary(directory), /Wrong game/)
    const write = (row: object) => fs.writeFile(filename, JSON.stringify({ game: "dos2", recipes: [row] }))
    const item = (name: string, extra = {}) => ({ name, tags: [], ...extra })
    // Random pools, random amounts and several products at once are valid...
    await write({
      ...recipe,
      result: item("Random Scroll", { pool: [item("A", { requirements: "Crafting 2" }), item("B")] }),
      extraResults: [item("Wood Chips", { quantity: "x(1-3)" })],
    })
    assert.equal((await loadLibrary(directory)).sources.dos2[0].result.pool?.length, 2)
    // ...but not in malformed shapes.
    for (const [row, error] of [
      [{ ...recipe, result: item("Random", { pool: [item("A")] }) }, /Invalid result/],
      [{ ...recipe, result: item("Random", { slug: "random", pool: [item("A"), item("B")] }) }, /Invalid result/],
      [{ ...recipe, result: item("A", { requirements: "Crafting 2" }) }, /Invalid result/],
      [{ ...recipe, result: item("A", { quantity: "some" }) }, /Invalid result/],
      [{ ...recipe, extraResults: [] }, /Invalid extra results/],
      [{ ...recipe, extraResults: [item("B")], transformsIngredient: 0 }, /Invalid extra results/],
    ] as const) {
      await write(row)
      await assert.rejects(loadLibrary(directory), error)
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("every recipe item link resolves to an item page", async () => {
  const library = await loadLibrary()
  const known = new Set(library.pages.map((page) => page.slug))
  const recipeItems = Object.values(library.sources)
    .flat()
    .flatMap((row) => [...recipeResults(row), ...(row.result.pool ?? []), ...row.ingredients])
  const missing = (items: { slug?: string }[]) =>
    items.flatMap((item) => (item.slug && !known.has(item.slug) ? [item.slug] : []))
  assert.deepEqual(missing(recipeItems), [], "Missing recipe pages")
  assert.deepEqual(missing(Object.values(library.items).flat()), [], "Missing item pages")
})

test("source recipes are unique and name real items, not lists or placeholders", async () => {
  const { sources } = await loadLibrary()
  for (const [game, recipes] of Object.entries(sources)) {
    // Same item identity as the generated catalog (pages on a generic Stats entry stay apart).
    assignDataKeys(recipes.flatMap((row) => [...recipeResults(row), ...(row.result.pool ?? []), ...row.ingredients]))
    assert.equal(expandSmallGroups(recipes, {}).length, recipes.length, `${game}: deduplicate the source JSON`)
    for (const row of recipes)
      for (const item of recipeResults(row))
        assert.ok(!/,|\(various|\(min,|element random/i.test(item.name), `${game}: ${row.id}`)
  }
})

test("recipe files carry upgrades separately and reject malformed ones", async () => {
  const { directory, recipe } = await fixture()
  const filename = path.join(directory, "recipes/dos2.json")
  const upgrade = {
    id: "shield:air",
    effect: { en: "Air Resistance" },
    target: { name: "Shield", tags: [] },
    targetTags: ["Shields"],
    tags: [],
    ingredients: [{ name: "Air Essence", tags: [] }],
    requirements: "",
    notes: "",
    remarks: "",
    source: "",
  }
  try {
    await fs.writeFile(filename, JSON.stringify({ game: "dos2", recipes: [recipe], upgrades: [upgrade] }))
    const library = await loadLibrary(directory)
    assert.deepEqual(library.upgrades.dos2, [upgrade])
    assert.deepEqual(library.upgrades.dos1, [])
    await fs.writeFile(
      filename,
      JSON.stringify({ game: "dos2", recipes: [recipe], upgrades: [{ ...upgrade, targetTags: [] }] }),
    )
    await assert.rejects(loadLibrary(directory), /Invalid upgrade target: shield:air/)
    await fs.writeFile(
      filename,
      JSON.stringify({ game: "dos2", recipes: [recipe], upgrades: [{ ...upgrade, effect: { en: "" } }] }),
    )
    await assert.rejects(loadLibrary(directory), /Invalid upgrade effect: shield:air/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
