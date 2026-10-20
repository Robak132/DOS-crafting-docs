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
  const html = renderToString(<RecipeTable recipes={[recipe]} catalogSlug="DOS2" labels={{}} />)
  for (const name of ["Hand Axe", "Hammer", "Anvil"]) {
    assert.ok(html.includes(`<span class="item-lang">${name}</span>`))
    assert.ok(!html.includes(`<span class="item-lang-en">${name}</span>`))
  }
  assert.ok(html.includes('<span class="item-lang-en">Leather Scraps</span>'))
  assert.ok(html.includes('<span class="item-lang-pl">Skrawki skóry</span>'))
})

test("recipe tables omit effects but preserve crafting instructions and align optional columns", () => {
  for (const showRequirements of [true, false]) {
    const html = renderToString(
      <RecipeTable
        recipes={[{ ...recipe, notes: "Effect must not appear", remarks: "Use a crafting station" }]}
        catalogSlug="DOS2"
        labels={{}}
        showRequirements={showRequirements}
      />,
    )
    assert.ok(!html.includes("Effect must not appear"))
    assert.ok(!html.includes('scope="col">Efekt'))
    assert.ok(!html.includes("data-search-effect"))
    assert.ok(html.includes("Use a crafting station"))
    assert.ok(html.includes('<ul class="recipe-ingredients">'))
    assert.equal(html.match(/<th scope="col">/g)?.length, showRequirements ? 5 : 4)
    assert.equal(html.match(/<td /g)?.length, showRequirements ? 5 : 4)
  }
})

test("group chips omit icons and link to matching items instead of an item page", () => {
  const html = renderToString(
    <RecipeTable
      recipes={[
        {
          ...recipe,
          ingredients: [
            {
              name: "#Fish",
              selectorTag: "Fish",
              tags: [],
              groupId: "fish",
              groupSize: 4,
              icon: "data/icons/groups/fish.svg",
            },
          ],
        },
      ]}
      catalogSlug="DOS2"
      labels={{}}
    />,
  )
  assert.ok(html.includes("recipe-item-group"))
  assert.ok(html.includes("?view=items&amp;group=fish"))
  assert.ok(!html.includes("data/icons/groups/fish.svg"))
  assert.ok(html.includes('class="group-count">4'))
})

test("expanded upgrades retain their modification and remain separate from ordinary crafting", () => {
  const upgraded = { ...recipe, transformsIngredient: 0, notes: "Tactical Retreat" }
  const html = renderToString(
    <RecipeTable
      recipes={[recipe, upgraded, { ...upgraded, id: "haste", notes: "Haste" }]}
      catalogSlug="DOS2"
      labels={{}}
    />,
  )
  assert.ok(html.includes('<p class="recipe-remarks">Tactical Retreat</p>'))
  assert.ok(html.includes('<p class="recipe-remarks">Haste</p>'))
  assert.equal(html.match(/class="recipe-cell result"/g)?.length, 3)
})
