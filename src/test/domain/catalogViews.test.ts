import assert from "node:assert/strict"
import { test } from "node:test"
import { catalogItems } from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

const recipe = (id: string, tags: string[], quantity = "x2"): RecipeRow => ({
  id,
  result: { name: "Potion", slug: "potion", tags, quantity },
  ingredients: [{ name: "Herb", tags: ["Materialy"] }],
  tags: [...tags, "Materialy"],
  requirements: "",
  notes: "",
  remarks: "",
  source: "",
})

test("items are unique across recipe variants and output quantities", () => {
  const rows = [recipe("one", ["Potions"]), recipe("two", ["Potions"], "x3")]
  assert.equal(catalogItems(rows).length, 1)
  assert.equal(catalogItems(rows)[0].quantity, undefined)
  assert.equal(rows[0].result.quantity, "x2")
})
