import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { ItemTooltip, tooltipItemName } from "../../main/components/ItemTooltip"
import { Item } from "../../main/domain/item"
import { Recipe } from "../../main/domain/recipe"

/** The text a reader sees: tags become spaces, runs of spaces collapse. */
const visibleText = (html: string) =>
  html
    .split(/[<>]/)
    .filter((_, index) => index % 2 === 0)
    .join(" ")
    .split(/\s+/)
    .join(" ")

const item = new Item({ name: "Leather Scraps", namePl: "Skrawki skóry", tags: [] })
const recipe = new Recipe({
  id: "leather",
  result: item.with({ quantity: "x2" }),
  ingredients: [
    { name: "Knife", tags: [] },
    { name: "Animal Hide", namePl: "Skóra zwierzęca", quantity: "x3", tags: [] },
  ],
  tags: [],
  notes: "",
  remarks: "",
  requirements: "Crafting 1",
  source: "",
})

test("tooltip titles show PL (EN), with English fallback and no duplicate translation", () => {
  assert.equal(tooltipItemName(item, "pl"), "Skrawki skóry (Leather Scraps)")
  assert.equal(tooltipItemName(item.with({ namePl: undefined }), "pl"), "Leather Scraps")
  assert.equal(tooltipItemName(item.with({ namePl: "  " }), "pl"), "Leather Scraps")
  assert.equal(tooltipItemName(item.with({ namePl: "leather scraps" }), "pl"), "Leather Scraps")
})

test("tooltip includes translated description, every crafting variant, quantities and requirements", () => {
  const html = renderToString(
    <ItemTooltip
      item={item}
      lang="pl"
      recipes={[recipe, recipe.with({ id: "alternate", ingredients: [{ name: "Scissors", tags: [] }] })]}
      description={{ en: "Leather description", pl: "Opis skóry" }}
    />,
  )
  assert.ok(html.includes("Skrawki skóry (Leather Scraps)"))
  assert.ok(html.includes("Opis skóry"))
  assert.ok(!html.includes("Leather description"))
  const text = visibleText(html)
  // Recipes show icons (names here, as the test items have none) with each full name on hover.
  assert.ok(text.includes("Knife + Skóra zwierzęca ×3"), text)
  assert.ok(text.includes("→ Skrawki skóry ×2"), text)
  assert.ok(html.includes('title="Skóra zwierzęca (Animal Hide)"'))
  assert.ok(html.includes("Scissors"))
  assert.ok(html.includes("Wymagania: Crafting 1"))
})

test("tooltip lists each part of an effect as its own bullet", () => {
  const html = renderToString(
    <ItemTooltip item={item.with({ effect: { en: "+1 Strength; +1 Finesse" } })} lang="en" recipes={[]} />,
  )
  assert.ok(html.includes("<li>+1 Strength</li><li>+1 Finesse</li>"), html)
})

test("tooltip omits sections with no data instead of showing missing-data messages", () => {
  const render = (props = {}) => renderToString(<ItemTooltip item={item} lang="pl" recipes={[]} {...props} />)
  const empty = render()
  assert.ok(empty.includes("Skrawki skóry (Leather Scraps)"))
  assert.ok(!empty.includes("<section>"))
  assert.ok(!empty.includes("Brak"))
  assert.ok(!empty.includes("Wczytywanie"))
  assert.ok(render({ description: { en: "English description" } }).includes("English description"))
  assert.ok(!render({ description: { en: "  ", pl: "  " } }).includes("<section>"))
})

test("tooltip shows distinct item effects and omits empty descriptions", () => {
  const html = renderToString(
    <ItemTooltip
      item={item}
      lang="pl"
      recipes={[
        recipe.with({ notes: "Efekt testowy +10%" }),
        recipe.with({ id: "alternate", notes: "Efekt testowy +10%" }),
      ]}
    />,
  )
  assert.ok(html.includes("<h3>Efekt</h3>"))
  assert.equal(html.split("Efekt testowy +10%").length - 1, 1)
  assert.ok(html.includes("<h3>Wytwarzanie</h3>"))
  assert.ok(!html.includes("<h3>Opis</h3>"))
  const emptyEffect = renderToString(<ItemTooltip item={item} lang="pl" recipes={[recipe.with({ notes: " - " })]} />)
  assert.ok(!emptyEffect.includes("<h3>Efekt</h3>"))
})

test("English mode shows only English names and description throughout the tooltip", () => {
  assert.equal(tooltipItemName(item, "en"), "Leather Scraps")
  const html = renderToString(
    <ItemTooltip
      item={item}
      lang="en"
      recipes={[recipe]}
      description={{ en: "Leather description", pl: "Opis skóry" }}
    />,
  )
  assert.ok(html.includes("Leather Scraps"))
  const text = visibleText(html)
  assert.ok(text.includes("Knife + Animal Hide ×3"), text)
  assert.ok(text.includes("→ Leather Scraps ×2"), text)
  assert.ok(html.includes("Leather description"))
  assert.ok(!html.includes("Skrawki skóry"))
  assert.ok(!html.includes("Skóra zwierzęca"))
  assert.ok(!html.includes("Opis skóry"))
})

test("ingredients without crafting recipes show exported effects in the selected language", () => {
  const ingredient = item.with({ effect: { en: "+5% air resistance", pl: "+5% odporności na powietrze" } })
  const pl = renderToString(<ItemTooltip item={ingredient} lang="pl" recipes={[]} />)
  const en = renderToString(<ItemTooltip item={ingredient} lang="en" recipes={[]} />)
  assert.ok(pl.includes("<h3>Efekt</h3>"))
  assert.ok(pl.includes("+5% odporności na powietrze"))
  assert.ok(en.includes("+5% air resistance"))
  assert.ok(!en.includes("+5% odporności na powietrze"))
  assert.ok(!pl.includes("Wytwarzanie"))
})
