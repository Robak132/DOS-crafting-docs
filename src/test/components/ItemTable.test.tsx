import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { ItemTable } from "../../main/components/ItemTable"
import { catalogItemRows } from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

const first: RecipeRow = {
  id: "one",
  result: {
    name: "Potion",
    namePl: "Mikstura",
    slug: "potion",
    tags: ["DOS2", "Typ/Mikstury", "Cechy/Leczenie"],
    quantity: "x2",
  },
  ingredients: [{ name: "Ingredient only", tags: [] }],
  tags: ["Typ/Materialy"],
  notes: "+2 Wits",
  remarks: "Crafting instructions",
  requirements: "",
  source: "",
}

const second = { ...first, id: "two", result: { ...first.result, quantity: "x3" }, notes: "+3 Intelligence" }

test("one item row collects distinct effects across all recipe variants", () => {
  const rows = catalogItemRows([first, second, { ...first, id: "three" }])
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].effects, ["+2 Bystrość", "+3 Inteligencja"])
  assert.equal(rows[0].item.quantity, undefined)
  assert.deepEqual(rows[0].tags, ["Typ/Mikstury", "Cechy/Leczenie"])
})

test("table has three columns and type categories with one row per item", () => {
  const html = renderToString(
    <ItemTable recipes={[first, second]} labels={{ "Typ/Mikstury": "Mikstury" }} itemHref={(slug) => `./${slug}`} />,
  )
  assert.ok(html.includes('<th scope="col">Przedmiot</th><th scope="col">Efekt</th><th scope="col">Tagi</th>'))
  assert.ok(html.includes('colspan="3" scope="rowgroup">Mikstury</th>'))
  assert.equal(html.match(/data-slug="potion"/g)?.length, 1)
  assert.ok(html.includes('data-search-effect="+2 Bystrość"'))
  assert.ok(html.includes('data-search-tag="Cechy/Leczenie"'))
  assert.ok(!html.includes("Ingredient only"))
  assert.ok(!html.includes("Crafting instructions"))
  assert.ok(!html.includes("x2"))
})

test("missing effects and categories remain readable; labels are escaped", () => {
  const html = renderToString(
    <ItemTable
      recipes={[{ ...first, notes: "", result: { name: "<unsafe>", tags: [] }, tags: [] }]}
      labels={{}}
      itemHref={(slug) => slug}
    />,
  )
  assert.ok(html.includes("Bez kategorii"))
  assert.ok(html.includes("&lt;unsafe"))
  assert.ok(!html.includes("<unsafe>"))
  assert.equal(html.match(/class="recipe-empty">—/g)?.length, 2)
  const empty = renderToString(<ItemTable recipes={[]} labels={{}} itemHref={(slug) => slug} />)
  assert.ok(empty.includes('colspan="3" class="recipe-empty">Brak przedmiotów pasujących do filtrów.'))
})
