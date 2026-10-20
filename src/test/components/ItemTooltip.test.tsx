import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { ItemTooltip, tooltipItemName } from "../../main/components/ItemTooltip"
import type { RecipeRow } from "../../main/domain/recipes"

const item = { name: "Leather Scraps", namePl: "Skrawki skóry", tags: [] }
const recipe: RecipeRow = {
  id: "leather",
  result: { ...item, quantity: "x2" },
  ingredients: [
    { name: "Knife", tags: [] },
    { name: "Animal Hide", namePl: "Skóra zwierzęca", quantity: "x3", tags: [] },
  ],
  tags: [],
  notes: "",
  remarks: "",
  requirements: "Crafting 1",
  source: "",
}

test("tooltip titles show PL (EN), with English fallback and no duplicate translation", () => {
  assert.equal(tooltipItemName(item, "pl"), "Skrawki skóry (Leather Scraps)")
  assert.equal(tooltipItemName({ ...item, namePl: undefined }, "pl"), "Leather Scraps")
  assert.equal(tooltipItemName({ ...item, namePl: "  " }, "pl"), "Leather Scraps")
  assert.equal(tooltipItemName({ ...item, namePl: "leather scraps" }, "pl"), "Leather Scraps")
})

test("tooltip includes translated description, every crafting variant, quantities and requirements", () => {
  const html = renderToString(
    <ItemTooltip
      item={item}
      lang="pl"
      recipes={[recipe, { ...recipe, id: "alternate", ingredients: [{ name: "Scissors", tags: [] }] }]}
      description={{ en: "Leather description", pl: "Opis skóry" }}
    />,
  )
  assert.ok(html.includes("Skrawki skóry (Leather Scraps)"))
  assert.ok(html.includes("Opis skóry"))
  assert.ok(!html.includes("Leather description"))
  assert.ok(html.includes("Knife + ×3 Skóra zwierzęca (Animal Hide)"))
  assert.ok(html.includes("→ ×2 Skrawki skóry (Leather Scraps)"))
  assert.ok(html.includes("Scissors"))
  assert.ok(html.includes("Wymagania: Crafting 1"))
})

test("tooltip distinguishes unavailable descriptions and crafting recipes from loading", () => {
  const render = (props = {}) => renderToString(<ItemTooltip item={item} lang="pl" recipes={[]} {...props} />)
  assert.ok(render().includes("Brak opisu w danych gry."))
  assert.ok(render().includes("Brak receptury wytwarzania w tym trybie gry."))
  assert.ok(render({ description: { en: "English description" } }).includes("English description"))
  assert.ok(render({ descriptionLoading: true }).includes("Wczytywanie opisu…"))
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
  assert.ok(html.includes("Knife + ×3 Animal Hide"))
  assert.ok(html.includes("→ ×2 Leather Scraps"))
  assert.ok(html.includes("Leather description"))
  assert.ok(!html.includes("Skrawki skóry"))
  assert.ok(!html.includes("Skóra zwierzęca"))
  assert.ok(!html.includes("Opis skóry"))
})
