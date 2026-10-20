import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { loadLibrary } from "../../scripts/load-library"

async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dos-json-library-"))
  await fs.mkdir(path.join(directory, "pages"))
  await fs.mkdir(path.join(directory, "recipes"))
  const page = {
    slug: "item",
    title: "An item",
    titlePl: "Przedmiot",
    tags: ["Typ/Materialy"],
    aliases: ["old-item"],
    itemPage: true,
    categoryPage: false,
    html: "<p>Source note</p>",
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
  await fs.writeFile(path.join(directory, "pages/item.json"), JSON.stringify(page))
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    await fs.writeFile(
      path.join(directory, "recipes", `${game}.json`),
      JSON.stringify({ game, recipes: game === "dos2" ? [recipe] : [] }),
    )
  }
  return { directory, page, recipe }
}

test("JSON library reads structured recipes, page metadata, aliases and source notes directly", async () => {
  const { directory, page, recipe } = await fixture()
  try {
    const library = await loadLibrary(directory)
    assert.deepEqual(library.pages, [page])
    assert.deepEqual(library.sources.dos2, [recipe])
    assert.deepEqual(library.sources["dos2-overhaul"], [])
    page.html = "<p>Updated note</p>"
    await fs.writeFile(path.join(directory, "pages/item.json"), JSON.stringify(page))
    assert.equal((await loadLibrary(directory)).pages[0].html, page.html)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("JSON source rejects empty tags and mismatched page URLs", async () => {
  const { directory, page } = await fixture()
  try {
    await fs.writeFile(path.join(directory, "pages/item.json"), JSON.stringify({ ...page, tags: [""] }))
    await assert.rejects(loadLibrary(directory), /Invalid tags/)
    await fs.writeFile(path.join(directory, "pages/item.json"), JSON.stringify({ ...page, slug: "other-url" }))
    await assert.rejects(loadLibrary(directory), /Page slug must match/)
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
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("repository JSON library is complete and independent of the removed Markdown directory", async () => {
  const library = await loadLibrary()
  assert.ok(library.pages.length > 0)
  assert.ok(library.pages.some((page) => page.slug === "Stanowiska-i-pojemniki/WOOD-PILE"))
  assert.ok(library.sources.dos1.length && library.sources.dos2.length && library.sources["dos2-overhaul"].length)
  await assert.rejects(fs.access("content"), /ENOENT/)
})

test("item metadata omits unused HTML and every active library link resolves", async () => {
  const library = await loadLibrary()
  const known = new Set([
    "index",
    "receptury",
    "DOS2",
    "dos2-crafting-overhaul",
    ...library.pages.flatMap((page) => [page.slug, ...page.aliases]),
  ])
  for (const page of library.pages) {
    const raw = JSON.parse(await fs.readFile(path.join("data/library/pages", `${page.slug}.json`), "utf8"))
    if (page.itemPage) {
      assert.equal(Object.hasOwn(raw, "html"), false, page.slug)
      assert.equal(page.html, "")
    }
    for (const match of page.html.matchAll(/href="__APP_BASE__\/([^"#?]+)/g)) {
      assert.ok(known.has(decodeURIComponent(match[1])), `Broken link on ${page.slug}: ${match[1]}`)
    }
  }
  for (const rows of Object.values(library.sources)) {
    for (const row of rows) {
      for (const item of [row.result, ...row.ingredients]) {
        if (item.slug) assert.ok(known.has(item.slug), `Missing recipe page: ${item.slug}`)
      }
    }
  }
})

test("merged mushroom pages retain old URLs and their game names have inventory icons", async () => {
  const library = await loadLibrary()
  const icons = JSON.parse(await fs.readFile("data/itemIcons.json", "utf8"))
  const { resolveItemIcon } = await import("../main/domain/itemIcons")
  for (const [name, slug] of [
    ["Calocera", "CALOCERA"],
    ["Boletus", "BOLETUS"],
    ["Amethyst Deceiver", "AMETHYST-DECEIVER"],
  ]) {
    const page = library.pages.find((page) => page.slug === `Skladniki/${slug}`)
    assert.equal(page?.title, name)
    assert.ok(page?.aliases.includes(`Skladniki/MUSHROOM-${slug}`))
    assert.ok(!library.pages.some((page) => page.title === `Mushroom ${name}`))
    const references = library.sources["dos2-overhaul"].flatMap((row) => [row.result, ...row.ingredients])
    const item = references.find((item) => item.slug === page?.slug)
    assert.equal(item?.name, name)
    assert.ok(item && resolveItemIcon(icons, "dos2-overhaul", item), name)
  }
})

test("item metadata can omit HTML while a content page must provide it", async () => {
  const { directory, page } = await fixture()
  try {
    const { html: _html, ...metadata } = page
    await fs.writeFile(path.join(directory, "pages/item.json"), JSON.stringify(metadata))
    assert.equal((await loadLibrary(directory)).pages[0].html, "")
    await fs.writeFile(path.join(directory, "pages/item.json"), JSON.stringify({ ...metadata, itemPage: false }))
    await assert.rejects(loadLibrary(directory), /Invalid page/)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
