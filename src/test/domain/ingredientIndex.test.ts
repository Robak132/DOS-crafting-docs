import assert from "node:assert/strict"
import { test } from "node:test"
import { recipesUsingItem } from "../../main/domain/recipeCatalog"
import { itemNameKeys, recipeUsesItem } from "../../main/domain/recipeView"
import type { RecipeData, RecipeRow } from "../../main/domain/recipes"

const makeRecipe = (id: string, ingredients: RecipeRow["ingredients"]): RecipeRow => ({
  id,
  ingredients,
  result: { name: `Result ${id}`, tags: [] },
  tags: [],
  notes: "",
  remarks: "",
  requirements: "",
  source: "",
})
const data: RecipeData = {
  recipes: [
    makeRecipe("one", [{ name: "Bottle of Water", namePl: "Butelka wody", slug: "water", tags: [] }]),
    makeRecipe("two", [
      { name: "#Łódź", tags: [] },
      { name: "Bottle of Water", slug: "other-water", tags: [] },
    ]),
    makeRecipe("three", [
      { name: "Apple", tags: [] },
      { name: "Apple", tags: [] },
    ]),
  ],
  tags: [],
  requirements: [],
  selectors: [],
}

test("ingredient index preserves slug matching, aliases, normalization and catalog order", () => {
  for (const [slug, names] of [
    ["water", itemNameKeys("Butelka wody")],
    ["missing", itemNameKeys("Bottle of Water")],
    ["other-water", itemNameKeys("Butelka wody", "Łódź")],
    ["missing", itemNameKeys("Lodz")],
    ["missing", itemNameKeys("Apple")],
    ["missing", itemNameKeys("Unknown")],
  ] as const) {
    const expected = data.recipes.filter((recipe) => recipeUsesItem(recipe, slug, names))
    assert.deepEqual(recipesUsingItem(data, slug, names), expected)
  }
})

test("indexes are isolated for new catalog snapshots after a rebuild", () => {
  const changed = { ...data, recipes: [makeRecipe("new", [{ name: "Apple", tags: [] }])] }
  assert.deepEqual(
    recipesUsingItem(data, "", itemNameKeys("Apple")).map((r) => r.id),
    ["three"],
  )
  assert.deepEqual(
    recipesUsingItem(changed, "", itemNameKeys("Apple")).map((r) => r.id),
    ["new"],
  )
})
