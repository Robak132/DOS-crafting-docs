import assert from "node:assert/strict"
import { test } from "node:test"
import { catalogItems } from "../../main/domain/recipeView"
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

test("multiple type tags and uncategorized items stay in one unique item list", () => {
  const multi = recipe("magic-weapon", ["Typ/Bron", "Typ/Magia", "Typ/Skladniki"])
  const uncategorized = { ...recipe("uncategorized", []), result: { name: "Other", tags: [] } }
  const items = catalogItems([multi, { ...multi, id: "another-recipe" }, uncategorized])
  assert.equal(items.length, 2)
  assert.deepEqual(new Set(items.map((item) => item.name)), new Set(["Potion", "Other"]))
  assert.deepEqual(catalogItems([]), [])
})
