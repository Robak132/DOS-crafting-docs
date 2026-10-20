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
    <ItemTable
      lang="pl"
      recipes={[first, second]}
      labels={{ "Typ/Mikstury": "Mikstury" }}
      itemHref={(slug) => `./${slug}`}
    />,
  )
  assert.ok(html.includes('<th scope="col">Przedmiot</th><th scope="col">Efekt</th><th scope="col">Tagi</th>'))
  assert.ok(html.includes('<section><h2>Mikstury</h2><div class="recipe-table-wrap"'))
  assert.ok(html.includes('aria-label="Przedmioty: Mikstury"'))
  assert.equal(html.match(/data-slug="potion"/g)?.length, 1)
  assert.ok(html.includes('data-search-effect="+2 Bystrość"'))
  assert.ok(html.includes('data-filter-tag="Cechy/Leczenie"'))
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
  assert.equal(empty, '<p class="recipe-empty">Brak przedmiotów pasujących do filtrów.</p>')
})

test("item list shows descriptions below names in the selected language and omits missing descriptions", () => {
  const render = (
    lang: "pl" | "en",
    descriptions: Record<string, { en: string; pl?: string }> = {
      potion: { en: "English description", pl: "Polski opis" },
    },
  ) =>
    renderToString(
      <ItemTable recipes={[first]} labels={{}} itemHref={(slug) => slug} descriptions={descriptions} lang={lang} />,
    )
  assert.ok(render("pl").includes('<p class="item-list-description">Polski opis</p>'))
  assert.ok(!render("pl").includes("English description"))
  assert.ok(render("en").includes('<p class="item-list-description">English description</p>'))
  assert.ok(!render("en").includes("Polski opis"))
  assert.ok(!render("pl", {}).includes("item-list-description"))
  assert.ok(!render("pl", { potion: { en: " ", pl: " " } }).includes("item-list-description"))
})

test("item lists and counts omit groups, including unresolved selectors and explicit alternatives", () => {
  const grouped = {
    ...first,
    result: { ...first.result, groupId: "fish", groupSize: 4, icon: "data/icons/should-not-render.webp" },
  }
  const recipes = [
    grouped,
    { ...first, result: { ...first.result, selectorTag: "Helmet" } },
    { ...first, result: { ...first.result, name: "Cloth Gloves, Boots" } },
  ]
  const html = renderToString(<ItemTable recipes={recipes} labels={{}} itemHref={(slug) => slug} />)
  assert.equal(catalogItemRows(recipes).length, 0)
  assert.ok(!html.includes("recipe-item-group"))
  assert.ok(!html.includes("<table"))
  assert.ok(html.includes("Brak przedmiotów pasujących do filtrów."))
  assert.ok(!html.includes("should-not-render.webp"))
})
