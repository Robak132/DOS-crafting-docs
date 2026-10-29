import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { TagLabels } from "../../main/domain/tagLabels"
import { ItemTable } from "../../main/components/ItemTable"
import { ItemList } from "../../main/domain/itemList"
import { Recipe } from "../../main/domain/recipe"
import { emptyFilters, filterRecipes } from "../../main/filters"

const first = new Recipe({
  id: "one",
  result: {
    name: "Potion",
    namePl: "Mikstura",
    slug: "potion",
    tags: ["DOS2", "Potions", "Healing"],
    quantity: "x2",
  },
  ingredients: [{ name: "Ingredient only", tags: [] }],
  tags: ["Materialy"],
  notes: "+2 Wits",
  remarks: "Crafting instructions",
  requirements: "",
  source: "",
})

const second = first.with({ id: "two", result: first.result.with({ quantity: "x3" }), notes: "+3 Intelligence" })

test("one item row collects distinct effects across all recipe variants", () => {
  const rows = new ItemList([first, second, first.with({ id: "three" })]).rows()
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].effects, ["+2 Bystrość", "+3 Inteligencja"])
  assert.equal(rows[0].item.quantity, undefined)
  assert.deepEqual(rows[0].tags, ["Potions", "Healing"])
})

test("table has three columns and one row per item without category sections", () => {
  const html = renderToString(
    <ItemTable
      lang="pl"
      recipes={[first, second]}
      labels={new TagLabels({ Potions: "Mikstury" })}
      itemHref={(slug) => `./${slug}`}
    />,
  )
  assert.ok(html.includes('<th scope="col">Przedmiot</th><th scope="col">Efekt</th><th scope="col">Tagi</th>'))
  assert.equal(html.match(/<table /g)?.length, 1)
  assert.ok(!html.includes("<section"))
  assert.ok(!html.includes("<h2"))
  assert.ok(html.includes('aria-label="Lista przedmiotów"'))
  assert.equal(html.match(/data-slug="potion"/g)?.length, 1)
  assert.ok(html.includes('data-search-effect="+2 Bystrość"'))
  assert.ok(html.includes('data-filter-tag="Healing"'))
  assert.ok(!html.includes("Ingredient only"))
  assert.ok(!html.includes("Crafting instructions"))
  assert.ok(!html.includes("x2"))
})

test("missing effects and categories remain readable; labels are escaped", () => {
  const html = renderToString(
    <ItemTable
      recipes={[first.with({ notes: "", result: { name: "<unsafe>", tags: [] }, tags: [] })]}
      labels={new TagLabels()}
      itemHref={(slug) => slug}
    />,
  )
  assert.ok(!html.includes("<h2"))
  assert.ok(html.includes("&lt;unsafe"))
  assert.ok(!html.includes("<unsafe>"))
  assert.ok(!html.includes("Efekt"))
  assert.equal(html.match(/class="recipe-empty">—/g)?.length, 1)
  const empty = renderToString(<ItemTable recipes={[]} labels={new TagLabels()} itemHref={(slug) => slug} />)
  assert.equal(empty, '<p class="recipe-empty">Brak przedmiotów pasujących do filtrów.</p>')
})

test("items with multiple type tags occur once alongside uncategorized items", () => {
  const multi = first.with({ result: first.result.with({ tags: ["Weapons", "Scrolls", "Ingredients"] }) })
  const other = first.with({ id: "other", result: { name: "Other item", slug: "other", tags: [] }, tags: [] })
  const html = renderToString(
    <ItemTable
      recipes={[multi, multi.with({ id: "variant" }), other]}
      labels={new TagLabels()}
      itemHref={(slug) => slug}
    />,
  )
  assert.equal(html.match(/<table /g)?.length, 1)
  assert.equal(html.match(/data-slug="potion"/g)?.length, 1)
  assert.equal(html.match(/data-slug="other"/g)?.length, 1)
  assert.equal(html.match(/<tr class=/g)?.length, 2)
  assert.ok(!html.includes("<h2"))
})

test("item list shows descriptions below names in the selected language and omits missing descriptions", () => {
  const render = (
    lang: "pl" | "en",
    descriptions: Record<string, { en: string; pl?: string }> = {
      potion: { en: "English description", pl: "Polski opis" },
    },
  ) =>
    renderToString(
      <ItemTable
        recipes={[first]}
        labels={new TagLabels()}
        itemHref={(slug) => slug}
        descriptions={descriptions}
        lang={lang}
      />,
    )
  assert.ok(render("pl").includes('<p class="item-list-description">Polski opis</p>'))
  assert.ok(!render("pl").includes("English description"))
  assert.ok(render("en").includes('<p class="item-list-description">English description</p>'))
  assert.ok(!render("en").includes("Polski opis"))
  assert.ok(!render("pl", {}).includes("item-list-description"))
  assert.ok(!render("pl", { potion: { en: " ", pl: " " } }).includes("item-list-description"))
})

test("item lists and counts omit groups, including unresolved selectors and explicit alternatives", () => {
  const grouped = first.with({
    result: first.result.with({ groupId: "fish", groupSize: 4, icon: "data/icons/should-not-render.webp" }),
  })
  const recipes = [
    grouped,
    first.with({ result: first.result.with({ selectorTag: "Helmet" }) }),
    first.with({ result: first.result.with({ name: "Cloth Gloves, Boots" }) }),
  ]
  const html = renderToString(<ItemTable recipes={recipes} labels={new TagLabels()} itemHref={(slug) => slug} />)
  assert.equal(new ItemList(recipes).rows().length, 0)
  assert.ok(!html.includes("recipe-item-group"))
  assert.ok(!html.includes("<table"))
  assert.ok(html.includes("Brak przedmiotów pasujących do filtrów."))
  assert.ok(!html.includes("should-not-render.webp"))
})

test("displayed effect search text finds its source with game vocabulary in both languages", () => {
  const recipes = [
    first.with({
      result: { name: "Apple Pie Dough", tags: [] },
      notes: "Add 10% Heal -1 Speed",
      effectLabels: { speed: "Speed" },
    }),
    first.with({
      result: {
        name: "Blood Rose Elixir",
        tags: [],
        effect: { en: "+1 Finesse; +1 Loremaster", pl: "+1 Zręczność; +1 Loremaster" },
      },
      notes: "",
    }),
  ]
  for (const lang of ["pl", "en"] as const) {
    for (const row of recipes) {
      const html = renderToString(
        <ItemTable recipes={[row]} labels={new TagLabels()} itemHref={(slug) => slug} lang={lang} />,
      )
      const clickedEffect = /data-search-effect="([^"]+)"/.exec(html)![1]
      assert.deepEqual(filterRecipes(recipes, { ...emptyFilters(), query: clickedEffect }, new TagLabels()), [row])
    }
  }
})
