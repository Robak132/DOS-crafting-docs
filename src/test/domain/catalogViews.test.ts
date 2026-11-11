import assert from "node:assert/strict"
import { test } from "node:test"
import { ItemList } from "../../main/domain/itemList"
import { Catalog } from "../../main/domain/catalog"
import { Recipe } from "../../main/domain/recipe"

const recipe = (id: string, tags: string[], quantity = "x2") =>
  new Recipe({
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
  const items = new ItemList(rows).items()
  assert.equal(items.length, 1)
  assert.equal(items[0].quantity, undefined)
  assert.equal(rows[0].result.quantity, "x2")
})

test("the item list also lists items only ever used as ingredients, with their own tags", () => {
  const potion = recipe("one", ["Potions"])
  const catalog = new Catalog({ recipes: [potion], tags: [], requirements: [] })
  catalog.stock = new ItemList(catalog.recipes).stock()
  assert.deepEqual(
    catalog.stock.map((item) => item.name),
    ["Herb"],
  )
  const rows = catalog.itemRows()
  assert.deepEqual(
    new ItemList(rows).items().map((item) => item.name),
    ["Herb", "Potion"],
  )
  assert.deepEqual(rows.at(-1)!.resultTags(), ["Materialy"])
  // The recipe list keeps crafts only.
  assert.deepEqual(catalog.recipes, [potion])
})
