import assert from "node:assert/strict"
import { test } from "node:test"
import { buildCatalogs } from "../../main/domain/recipeCatalog"
import { catalogItems } from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

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
