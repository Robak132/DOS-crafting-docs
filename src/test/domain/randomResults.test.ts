import assert from "node:assert/strict"
import { test } from "node:test"
import { formatItemQuantity, isRandomQuantity } from "../../main/domain/recipeQuantity"
import { catalogItems, matchesRecipeQuery, recipeRollsItem, itemNameKeys } from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

const random: RecipeRow = {
  id: "random",
  result: {
    name: "Random Air Scroll",
    tags: [],
    pool: [
      { name: "Airshield Scroll", slug: "airshield-scroll", tags: [], requirements: "Crafting 2" },
      { name: "Tornado Scroll", tags: [], requirements: "Crafting 4" },
    ],
  },
  ingredients: [{ name: "Blank Air Scroll", tags: [] }],
  tags: [],
  requirements: "Crafting 2",
  notes: "",
  remarks: "",
  source: "",
}

test("random amounts are written x(1-3) and shown as ×(1–3), unknown ones as ×(?)", () => {
  assert.equal(formatItemQuantity("x(1-3)"), "×(1–3)")
  assert.equal(formatItemQuantity("x(?)"), "×(?)")
  assert.equal(formatItemQuantity("x2"), "×2")
  assert.ok(isRandomQuantity("x(2-3)") && !isRandomQuantity("x3"))
})

test("a random pool is not an item, but every item it can roll is", () => {
  const names = catalogItems([random]).map((item) => item.name)
  assert.deepEqual(names, ["Airshield Scroll", "Tornado Scroll"])
  assert.ok(catalogItems([random]).every((item) => !("requirements" in item)))
})

test("pool items are found by search and link back to the recipe that rolls them", () => {
  assert.ok(matchesRecipeQuery(random, "tornado", {}))
  assert.ok(recipeRollsItem(random, "airshield-scroll", new Set()))
  assert.ok(recipeRollsItem(random, undefined, itemNameKeys("Tornado Scroll")))
  assert.ok(!recipeRollsItem(random, "blank-air-scroll", itemNameKeys("Blank Air Scroll")))
})
