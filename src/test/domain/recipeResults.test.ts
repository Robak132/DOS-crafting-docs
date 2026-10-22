import assert from "node:assert/strict"
import { test } from "node:test"
import { formatItemQuantity } from "../../main/domain/recipeQuantity"
import {
  catalogItemRows,
  catalogItems,
  groupRecipes,
  itemNameKeys,
  matchesRecipeQuery,
  recipeRollsItem,
  uniqueItemEffects,
} from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

const row = (id: string, fields: Partial<RecipeRow>): RecipeRow => ({
  id,
  result: { name: id, tags: [] },
  ingredients: [{ name: "Pickaxe", tags: [] }],
  tags: [],
  requirements: "",
  notes: "",
  remarks: "",
  source: "",
  ...fields,
})

const random = row("random", {
  result: {
    name: "Random Air Scroll",
    tags: [],
    pool: [
      { name: "Airshield Scroll", slug: "airshield-scroll", tags: [], requirements: "Crafting 2" },
      { name: "Tornado Scroll", tags: [], requirements: "Crafting 4" },
    ],
  },
})

const scrap = row("scrap", {
  result: { name: "Short Stick", slug: "short-stick", tags: ["Ingredients"], effect: { en: "Stick" } },
  extraResults: [{ name: "Metal Scraps", slug: "metal-scraps", tags: ["Metale"], quantity: "x2" }],
  notes: "Effect of the stick",
})

test("random amounts are written x(1-3) and shown as ×(1–3), unknown ones as ×(?)", () => {
  assert.equal(formatItemQuantity("x(1-3)"), "×(1–3)")
  assert.equal(formatItemQuantity("x(?)"), "×(?)")
  assert.equal(formatItemQuantity("x2"), "×2")
})

test("a random pool is not an item, but every item it can roll is, and links back to the recipe", () => {
  assert.deepEqual(
    catalogItems([random]).map((item) => item.name),
    ["Airshield Scroll", "Tornado Scroll"],
  )
  assert.ok(catalogItems([random]).every((item) => !("requirements" in item)))
  assert.ok(matchesRecipeQuery(random, "tornado", {}))
  assert.ok(recipeRollsItem(random, "airshield-scroll", new Set()))
  assert.ok(recipeRollsItem(random, undefined, itemNameKeys("Tornado Scroll")))
  assert.ok(!recipeRollsItem(random, "pickaxe", itemNameKeys("Pickaxe")))
})

test("every product of a recipe is an item with its own tags; saved notes describe only the main one", () => {
  assert.deepEqual(
    catalogItems([scrap]).map((item) => item.name),
    ["Metal Scraps", "Short Stick"],
  )
  const rows = Object.fromEntries(catalogItemRows([scrap], "en").map((entry) => [entry.item.name, entry]))
  assert.deepEqual(rows["Metal Scraps"].tags, ["Metale"])
  assert.deepEqual(rows["Metal Scraps"].effects, [])
  assert.deepEqual(rows["Short Stick"].effects, ["Effect of the stick"])
  assert.deepEqual(uniqueItemEffects([scrap], "en", scrap.extraResults![0]), [])
  assert.ok(matchesRecipeQuery(scrap, "metal scraps", {}))
})

test("recipes share a result cell only when they make the same products", () => {
  const same = { ...scrap, id: "scrap-2", ingredients: [{ name: "Sword", tags: [] }] }
  const other = { ...scrap, id: "scrap-3", extraResults: undefined }
  assert.deepEqual(
    groupRecipes([scrap, same, other]).map((group) => group.variants.map((variant) => variant.id)),
    [["scrap", "scrap-2"], ["scrap-3"]],
  )
  assert.equal(groupRecipes([scrap])[0].results.length, 2)
})
