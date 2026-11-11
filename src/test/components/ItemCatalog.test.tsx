import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { ItemCatalog } from "../../main/components/ItemCatalog"
import { ItemList } from "../../main/domain/itemList"
import { Recipe } from "../../main/domain/recipe"
import { TagLabels } from "../../main/domain/tagLabels"
import { Upgrade } from "../../main/domain/upgrade"

const first = new Recipe({
  id: "one",
  result: { name: "Potion", namePl: "Mikstura", slug: "potion", tags: ["DOS2", "Potions", "Healing"], quantity: "x2" },
  ingredients: [
    { name: "Herb", namePl: "Zioło", slug: "herb", tags: [] },
    { name: "Water", tags: [] },
  ],
  tags: ["Materialy"],
  notes: "+2 Wits; +1 Memory",
  remarks: "Crafting instructions",
  requirements: "Crafting 2",
  source: "Book",
})
const second = first.with({ id: "two", result: first.result.with({ quantity: "x3" }), notes: "+3 Intelligence" })
const render = (recipes: Recipe[], props: Partial<Parameters<typeof ItemCatalog>[0]> = {}) =>
  renderToString(
    <ItemCatalog
      rows={new ItemList(recipes).rows("pl")}
      labels={new TagLabels({ Potions: "Mikstury" })}
      catalogSlug="DOS2"
      lang="pl"
      {...props}
    />,
  )

test("one entry per item collects every recipe making it, its effects and tags", () => {
  const rows = new ItemList([first, second, first.with({ id: "three" })]).rows()
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].effects, ["+2 Bystrość; +1 Pamięć", "+3 Inteligencja"])
  assert.equal(rows[0].crafts.length, 3)
  assert.equal(rows[0].item.quantity, undefined)
  assert.deepEqual(rows[0].tags, ["Potions", "Healing"])
})

test("a card shows the item, its effects as bullets and each recipe with ingredients, yield and details", () => {
  const html = render([first, second], { showRequirements: true })
  assert.equal(html.match(/<article class="item-card">/g)?.length, 1)
  assert.ok(html.includes("<strong>Mikstura</strong>"))
  assert.ok(html.includes('class="item-card-alt">Potion<'))
  assert.ok(html.includes("<li>+2 Bystrość</li><li>+1 Pamięć</li>"))
  assert.equal(html.match(/class="item-card-recipe"/g)?.length, 2)
  assert.ok(html.includes("Zioło") && html.includes("Water"))
  assert.ok(html.includes("×2") && html.includes("×3"))
  assert.ok(html.includes("Wymagania: Crafting 2") && html.includes("Źródło: Book"))
  assert.ok(html.includes("Crafting instructions"))
  assert.ok(html.includes('data-filter-tag="Healing"'))
  assert.ok(!render([first]).includes("Wymagania"))
})

test("descriptions follow the language and items no recipe makes say so", () => {
  const descriptions = { potion: { en: "English description", pl: "Polski opis" } }
  assert.ok(render([first], { descriptions }).includes('<p class="item-card-description">Polski opis</p>'))
  assert.ok(render([first], { descriptions, lang: "en" }).includes("English description"))
  const herb = Recipe.listing(first.ingredients[0])
  const html = render([herb])
  assert.ok(html.includes("Nie da się go wytworzyć."))
  assert.ok(!html.includes("Wytwarzanie"))
})

test("an item from a random result lists the roll; groups are never items", () => {
  const roll = first.with({
    id: "roll",
    result: {
      name: "Random Scroll",
      tags: [],
      pool: [{ name: "Fire Scroll", slug: "fire-scroll", tags: ["Scrolls"] }],
    },
  })
  const html = render([roll])
  assert.ok(html.includes("Można wylosować z"))
  assert.ok(html.includes("Random Scroll"))
  const grouped = first.with({ result: first.result.with({ groupId: "fish", groupSize: 4 }) })
  assert.equal(new ItemList([grouped]).rows().length, 0)
  assert.ok(render([grouped]).includes("Brak przedmiotów pasujących do filtrów."))
})

test("a card lists the upgrades the item is an ingredient of, named as boosts, but not those it can take", () => {
  const boost = new Upgrade({
    id: "air",
    effect: { en: "Air Resistance", pl: "Odporność na powietrze" },
    target: { name: "Potion", tags: [] },
    targetTags: ["Potions"],
    tags: [],
    ingredients: [{ name: "Herb", namePl: "Zioło", slug: "herb", tags: [] }],
    requirements: "",
    notes: "",
    remarks: "",
    source: "",
  })
  assert.ok(!render([first], { upgrades: [boost] }).includes("Możliwe ulepszenia"))
  const herb = render([Recipe.listing(first.ingredients[0])], { upgrades: [boost] })
  assert.ok(herb.includes("Składnik ulepszeń"))
  assert.ok(herb.includes("Wzmocnienie: Odporność na powietrze"))
})
