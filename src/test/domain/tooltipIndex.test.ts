import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import { buildTooltipIndex } from "../../main/domain/tooltipIndex"
import { itemNameKeys } from "../../main/domain/recipeView"
import { parseItemQuantity } from "../../main/domain/recipeQuantity"
import type { RecipeRow } from "../../main/domain/recipes"
import { buildCatalogs } from "../../main/domain/recipeCatalog"
import { tooltipItemKey } from "../../main/domain/tooltipIdentity"
import { uniqueItemEffects } from "../../main/domain/recipeView"

const sources = Object.fromEntries(
  ["dos1", "dos2", "dos2-overhaul"].map((game) => [
    game,
    JSON.parse(fs.readFileSync(`data/library/recipes/${game}.json`, "utf8")).recipes,
  ]),
) as Parameters<typeof buildCatalogs>[0]

test("tooltip index preserves crafting variants and order for all three catalogs", () => {
  for (const catalog of Object.values(buildCatalogs(sources, [], {}))) {
    const index = buildTooltipIndex(catalog.recipes)
    const items = [...new Set(catalog.recipes.flatMap((row) => [row.result, ...row.ingredients]))]
    for (const item of items) {
      const keys = itemNameKeys(item.name, parseItemQuantity(item.name).base)
      const expected = catalog.recipes.filter((row) =>
        item.statsId
          ? row.result.statsId === item.statsId
          : (item.slug && row.result.slug === item.slug) ||
            (!row.result.statsId && [...itemNameKeys(row.result.name)].some((key) => keys.has(key))),
      )
      assert.deepEqual(index.recipesFor(item), expected, item.name)
      assert.equal(index.recipesFor(item), index.recipesFor(item), "Repeated hovers reuse the cached array")
    }
  }
})

test("tooltip lookups support names and slugs without treating ingredient groups as items", () => {
  const recipes: RecipeRow[] = [
    {
      id: "one",
      result: { name: "Potion", slug: "potion", tags: [] },
      ingredients: [
        { name: "Only Ingredient", tags: [] },
        { name: "#Fish", selectorTag: "Fish", tags: [] },
      ],
      tags: [],
      requirements: "",
      notes: "",
      remarks: "",
      source: "",
    },
  ]
  const index = buildTooltipIndex(recipes)
  assert.equal(index.find("potion", ""), recipes[0].result)
  assert.equal(index.find("", "POTION"), recipes[0].result)
  assert.equal(index.find("", "Only Ingredient"), recipes[0].ingredients[0])
  assert.equal(index.find("", "#Fish"), undefined)
  assert.deepEqual(index.recipesFor(recipes[0].ingredients[0]), [])
})

test("healing and disguised poison variants retain their own tooltip effects and recipes", () => {
  const effects = JSON.parse(fs.readFileSync("data/itemEffects.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    const catalog = buildCatalogs(sources, [], {})[game]
    const variants = catalog.recipes
      .filter((row) => row.result.slug === "Skladniki/MINOR-HEALING-POTION")
      .map((row) => ({
        ...row,
        result: { ...row.result, effect: effects[game].minorhealingpotion.recipes[row.id] },
      }))
    assert.equal(variants.length, 2)
    assert.notEqual(tooltipItemKey(variants[0].result), tooltipItemKey(variants[1].result))
    for (const recipes of [variants, [...variants].reverse()]) {
      const index = buildTooltipIndex(recipes)
      const aggregate = index.find(variants[0].result.slug!, variants[0].result.name)!
      assert.equal(aggregate.effect, undefined)
      assert.deepEqual(index.recipesFor(aggregate), recipes)
      assert.deepEqual(
        new Set(uniqueItemEffects(index.recipesFor(aggregate), "en", aggregate)),
        new Set(variants.map((row) => row.result.effect.en)),
      )
      for (const row of variants) {
        // ItemTable removes quantity when collecting items.
        const key = tooltipItemKey({ ...row.result, quantity: undefined })
        const item = index.find(row.result.slug!, row.result.name, key)!
        assert.equal(item, row.result)
        assert.deepEqual(index.recipesFor(item), [row])
        assert.deepEqual(uniqueItemEffects(index.recipesFor(item), "en", item), [row.result.effect.en])
      }
    }
  }
})
