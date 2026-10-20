import assert from "node:assert/strict"
import { test } from "node:test"
import { catalogItems, groupCatalogByTags } from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

const recipe = (id: string, tags: string[], quantity = "x2"): RecipeRow => ({
  id,
  result: { name: "Potion", slug: "potion", tags, quantity },
  ingredients: [{ name: "Herb", tags: ["Typ/Materialy"] }],
  tags: [...tags, "Typ/Materialy"],
  requirements: "",
  notes: "",
  remarks: "",
  source: "",
})

test("items are unique across recipe variants and output quantities", () => {
  const rows = [recipe("one", ["Typ/Mikstury"]), recipe("two", ["Typ/Mikstury"], "x3")]
  assert.equal(catalogItems(rows).length, 1)
  assert.equal(catalogItems(rows)[0].quantity, undefined)
  assert.equal(rows[0].result.quantity, "x2")
})

test("item sections use leaf tags of results, excluding game tags and ingredient tags", () => {
  const sections = groupCatalogByTags([recipe("one", ["DOS1", "Typ", "Typ/Mikstury", "Cechy/Leczenie"])], "items", {
    "Typ/Mikstury": "Mikstury",
  })
  assert.deepEqual(new Set(sections.map((section) => section.tag)), new Set(["Typ/Mikstury", "Cechy/Leczenie"]))
  assert.equal(sections.find((section) => section.tag === "Typ/Mikstury")?.label, "Mikstury")
})

test("recipe sections use only type tags and retain every variant", () => {
  const rows = [recipe("one", ["Typ/Mikstury", "Cechy/Leczenie"]), recipe("two", ["Typ/Mikstury"])]
  const sections = groupCatalogByTags(rows, "recipes", {})
  assert.equal(sections.length, 1)
  assert.equal(sections[0].tag, "Typ/Mikstury")
  assert.equal(sections[0].recipes.length, 2)
})

test("uncategorized results remain visible and empty filters produce no sections", () => {
  const sections = groupCatalogByTags([recipe("one", ["DOS1"])], "recipes", {})
  assert.equal(sections[0].label, "Bez kategorii")
  assert.deepEqual(groupCatalogByTags([], "items", {}), [])
})

test("items and recipes appear in every matching type category", () => {
  const rows = [recipe("magic-weapon", ["Typ/Bron", "Typ/Magia", "Typ/Skladniki"])]
  for (const view of ["items", "recipes"] as const) {
    const sections = groupCatalogByTags(rows, view, {})
    assert.deepEqual(new Set(sections.map((section) => section.tag)), new Set(rows[0].result.tags))
    for (const section of sections) assert.deepEqual(section.recipes, rows)
  }
  assert.equal(catalogItems(rows).length, 1)
})
