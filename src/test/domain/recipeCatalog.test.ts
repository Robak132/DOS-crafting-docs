import assert from "node:assert/strict"
import { test } from "node:test"
import { buildCatalogs } from "../../main/domain/recipeCatalog"
import { catalogItems } from "../../main/domain/recipeView"
import type { RecipeRow, RecipeUpgrade } from "../../main/domain/recipes"

const recipe = (name: string, category: string): RecipeRow => ({
  id: name,
  result: { name, slug: name, tags: [category] },
  ingredients: [{ name: "Ingredient", tags: [] }],
  tags: [category],
  notes: "",
  remarks: "",
  requirements: "",
  source: "",
})

test("JSON Overhaul additions extend every base DOS2 recipe, item and tag without DOS1", () => {
  const sources = {
    dos1: [recipe("DOS1 item", "Typ/Pancerz")],
    dos2: [recipe("Base item", "Typ/Mikstury")],
    "dos2-overhaul": [recipe("Mod item", "Typ/Bron")],
  }
  const catalogs = buildCatalogs(sources, [], {})
  const base = catalogs.dos2
  const combined = catalogs["dos2-overhaul"]
  assert.equal(base.recipes.length, 1)
  assert.equal(combined.recipes.length, 2)
  assert.ok(base.recipes.every((recipe) => combined.recipes.some((row) => row.id === recipe.id)))
  assert.deepEqual(
    catalogItems(combined.recipes).map((item) => item.name),
    ["Base item", "Mod item"],
  )
  for (const tag of base.tags) assert.ok(combined.tags.some((entry) => entry.tag === tag.tag))
  assert.ok(!combined.recipes.some((row) => row.result.name === "DOS1 item"))
  assert.equal(sources["dos2-overhaul"].length, 1, "Building must not add base recipes to the JSON source")
})

test("JSON recipe compilation refreshes translations and statistics without mutating sources", () => {
  const source = recipe("Spirit", "Typ/Mikstury")
  source.result.namePl = "Spirytus"
  const catalogs = buildCatalogs({ dos1: [source], dos2: [source], "dos2-overhaul": [] }, [], {})
  assert.equal(catalogs.dos1.recipes[0].result.namePl, "Spirytus")
  assert.equal(catalogs.dos2.recipes[0].result.namePl, "Duch")
  assert.equal(catalogs.dos2.tags.find((tag) => tag.tag === "Typ/Mikstury")?.count, 1)
  assert.equal(source.result.namePl, "Spirytus")
})

test("Overhaul upgrades extend the DOS2 ones and their items are localized per game", () => {
  const upgrade = (id: string): RecipeUpgrade => ({
    id,
    effect: { en: "Wits" },
    target: { name: "Shield", tags: [] },
    targetTags: ["Typ/Pancerz/Tarcze"],
    tags: [],
    ingredients: [{ name: "Apple", tags: [] }],
    requirements: "",
    notes: "",
    remarks: "",
    source: "",
  })
  const sources = { dos1: [], dos2: [], "dos2-overhaul": [] }
  const catalogs = buildCatalogs(
    sources,
    [],
    {},
    { dos1: [], dos2: [upgrade("base")], "dos2-overhaul": [upgrade("mod")] },
  )
  assert.deepEqual(
    catalogs["dos2-overhaul"].upgrades?.map((entry) => entry.id),
    ["base", "mod"],
  )
  assert.deepEqual(catalogs.dos1.upgrades, [])
  assert.equal(catalogs.dos2.upgrades?.[0].ingredients[0].namePl, "Jabłko")
  assert.equal(catalogs.dos2.upgrades?.[0].effect.pl, "Bystrość")
})
