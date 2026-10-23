import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import { buildTooltipIndex } from "../../main/domain/tooltipIndex"
import { itemNameKeys } from "../../main/domain/recipeView"
import { parseItemQuantity } from "../../main/domain/recipeQuantity"
import type { RecipeRow } from "../../main/domain/recipes"
import { buildCatalogs } from "../../main/domain/recipeCatalog"
import { tooltipItemKey } from "../../main/domain/tooltipIdentity"
import { itemEffectKey } from "../../main/domain/itemIcons"

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
      const rolls = (row: RecipeRow) =>
        [...(row.extraResults ?? []), ...(row.result.pool ?? [])].some(
          (entry) =>
            (item.slug && entry.slug === item.slug) || [...itemNameKeys(entry.name)].some((key) => keys.has(key)),
        )
      const expected = catalog.recipes.filter((row) =>
        item.statsId
          ? row.result.statsId === item.statsId
          : (item.slug && row.result.slug === item.slug) ||
            (!row.result.statsId && [...itemNameKeys(row.result.name)].some((key) => keys.has(key))) ||
            rolls(row),
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

test("healing potions and their disguised poison variants are separate game items with their own effects", () => {
  const effects = JSON.parse(fs.readFileSync("data/itemEffects.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    const catalog = buildCatalogs(sources, [], {})[game]
    const result = (slug: string) => catalog.recipes.find((row) => row.result.slug === slug)!.result
    const healing = result("minor-healing-potion")
    const poisoned = result("minor-healing-potion-2")
    assert.equal(healing.statsId, "POTION_Minor_Healing_Potion")
    assert.equal(poisoned.statsId, "POTION_Healing_Poisoned_Masked_Minor_A")
    assert.notEqual(tooltipItemKey(healing), tooltipItemKey(poisoned))
    assert.match(effects[game][itemEffectKey(healing)].en, /Restores vitality/)
    assert.match(effects[game][itemEffectKey(poisoned)].en, /Poisoned/)
    const index = buildTooltipIndex(catalog.recipes)
    assert.ok(
      index.recipesFor(index.find(poisoned.slug!, poisoned.name)!).every((row) => row.result.slug === poisoned.slug),
    )
  }
})
