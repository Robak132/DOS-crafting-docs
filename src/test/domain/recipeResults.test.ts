import assert from "node:assert/strict"
import { test } from "node:test"
import { Item } from "../../main/domain/item"
import { ItemList, ItemRecipes } from "../../main/domain/itemList"
import { Recipe, type RecipeData } from "../../main/domain/recipe"
import { ResultGroup } from "../../main/domain/resultGroup"
import { SearchQuery } from "../../main/domain/searchQuery"
import { TagLabels } from "../../main/domain/tagLabels"
import { TextKey } from "../../main/domain/textKey"

const row = (id: string, fields: Partial<RecipeData>) =>
  new Recipe({
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
const matches = (recipe: Recipe, query: string) => recipe.matches(new SearchQuery(query), new TagLabels())

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
  const label = (quantity: string) => new Item({ name: "Arrow", tags: [], quantity }).quantityLabel
  assert.equal(label("x(1-3)"), "×(1–3)")
  assert.equal(label("x(?)"), "×(?)")
  assert.equal(label("x2"), "×2")
})

test("a random pool is not an item, but every item it can roll is, and links back to the recipe", () => {
  const items = new ItemList([random]).items()
  assert.deepEqual(
    items.map((item) => item.name),
    ["Airshield Scroll", "Tornado Scroll"],
  )
  assert.ok(items.every((item) => !("requirements" in item)))
  assert.ok(matches(random, "tornado"))
  assert.ok(random.canRoll("airshield-scroll", new Set()))
  assert.ok(random.canRoll(undefined, TextKey.names("Tornado Scroll")))
  assert.ok(!random.canRoll("pickaxe", TextKey.names("Pickaxe")))
})

test("every product of a recipe is an item with its own tags; saved notes describe only the main one", () => {
  assert.deepEqual(
    new ItemList([scrap]).items().map((item) => item.name),
    ["Metal Scraps", "Short Stick"],
  )
  const rows = Object.fromEntries(new ItemList([scrap]).rows("en").map((entry) => [entry.item.name, entry]))
  assert.deepEqual(rows["Metal Scraps"].tags, ["Metale"])
  assert.deepEqual(rows["Metal Scraps"].effects, [])
  assert.deepEqual(rows["Short Stick"].effects, ["Effect of the stick"])
  assert.deepEqual(new ItemRecipes([scrap], scrap.extraResults![0]).effects("en"), [])
  assert.ok(matches(scrap, "metal scraps"))
})

test("recipes share a result cell only when they make the same products", () => {
  const same = scrap.with({ id: "scrap-2", ingredients: [{ name: "Sword", tags: [] }] })
  const other = scrap.with({ id: "scrap-3", extraResults: undefined })
  assert.deepEqual(
    ResultGroup.of([scrap, same, other]).map((group) => group.variants.map((variant) => variant.id)),
    [["scrap", "scrap-2"], ["scrap-3"]],
  )
  assert.equal(ResultGroup.of([scrap])[0].results.length, 2)
})
