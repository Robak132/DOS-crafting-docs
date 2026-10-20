import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { RecipeTable } from "../../main/components/RecipeTable"
import type { RecipeRow } from "../../main/domain/recipes"

const recipe: RecipeRow = {
  id: "fallback-name",
  result: { name: "Hand Axe", icon: "data/icons/dos2/hand-axe.webp", tags: [] },
  ingredients: [
    { name: "Hammer", tags: [] },
    { name: "Anvil", namePl: "Anvil", tags: [] },
    { name: "Leather Scraps", namePl: "Skrawki skóry", tags: [] },
  ],
  tags: [],
  requirements: "",
  notes: "",
  remarks: "",
  source: "",
}

test("recipe names without a distinct translation remain visible in Polish mode", () => {
  const html = renderToString(<RecipeTable recipes={[recipe]} slug="DOS2" catalogSlug="DOS2" labels={{}} />)
  for (const name of ["Hand Axe", "Hammer", "Anvil"]) {
    assert.ok(html.includes(`<span class="item-lang">${name}</span>`))
    assert.ok(!html.includes(`<span class="item-lang-en">${name}</span>`))
  }
  assert.ok(html.includes('<span class="item-lang-en">Leather Scraps</span>'))
  assert.ok(html.includes('<span class="item-lang-pl">Skrawki skóry</span>'))
})
