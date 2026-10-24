import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { RecipeTable } from "../../main/components/RecipeTable"
import type { RecipeRow } from "../../main/domain/recipes"
import { buildTooltipIndex } from "../../main/domain/tooltipIndex"
import { tooltipItemKey } from "../../main/domain/tooltipIdentity"

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

test("multiple categories do not duplicate recipes or their crafting variants", () => {
  const multi = { ...recipe, result: { ...recipe.result, tags: ["Weapons", "Scrolls", "Ingredients"] } }
  const variant = { ...multi, id: "variant", ingredients: [{ name: "Another ingredient", tags: [] }] }
  const other = { ...recipe, id: "other", result: { name: "Uncategorized", tags: [] } }
  const html = renderToString(<RecipeTable recipes={[multi, variant, other]} catalogSlug="DOS2" labels={{}} />)
  assert.equal(html.match(/<table /g)?.length, 1)
  assert.equal(html.match(/<tr data-recipe-id=/g)?.length, 3)
  assert.equal(html.match(/class="recipe-cell result"/g)?.length, 2)
  assert.ok(html.includes('rowspan="2"'))
  assert.ok(!html.includes("<h2"))
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
  assert.ok(html.includes("?view=items&amp;q=%23Fish&amp;as=result"))
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

test("shared item slugs with different effects render separate results with exact tooltip identities", () => {
  const healing = {
    ...recipe,
    result: { ...recipe.result, slug: "potion", effect: { en: "Restores vitality" } },
  }
  const poisoned = {
    ...healing,
    id: "poisoned",
    result: { ...healing.result, effect: { en: "Poisoned" } },
  }
  const html = renderToString(<RecipeTable recipes={[healing, poisoned]} catalogSlug="DOS2" labels={{}} />)
  assert.equal(html.match(/class="recipe-cell result"/g)?.length, 2)
  const index = buildTooltipIndex([healing, poisoned])
  for (const row of [healing, poisoned]) {
    const key = tooltipItemKey(row.result)
    assert.ok(html.includes(`data-tooltip-key="${key.replaceAll('"', "&quot;")}"`))
    assert.equal(index.find("potion", row.result.name, key), row.result)
  }
})

test("a random result lists its possible items with links, levels and random amounts", () => {
  const html = renderToString(
    <RecipeTable
      recipes={[
        {
          ...recipe,
          id: "random",
          result: {
            name: "Random Air Scroll",
            tags: [],
            pool: [
              { name: "Teleportation Scroll", slug: "teleportation-scroll", tags: [], requirements: "Crafting 2" },
              { name: "Tornado Scroll", tags: [], requirements: "Crafting 4" },
            ],
          },
          ingredients: [{ name: "Wood Chips", tags: [], quantity: "x(1-3)" }],
        },
      ]}
      catalogSlug="receptury"
      labels={{}}
    />,
  )
  assert.match(html, /<details class="recipe-pool"><summary>Możliwe wyniki \(2\)<\/summary>/)
  assert.ok(html.includes('href="/receptury/teleportation-scroll"'))
  assert.ok(html.includes('<span class="recipe-pool-level">Crafting 4</span>'))
  assert.ok(html.includes("×(1–3)"))
})

test("a recipe with several products lists each of them in the result cell", () => {
  const html = renderToString(
    <RecipeTable
      recipes={[
        {
          ...recipe,
          result: { name: "Short Stick", slug: "short-stick", tags: [] },
          extraResults: [{ name: "Metal Scraps", slug: "metal-scraps", tags: [], quantity: "x2" }],
        },
      ]}
      catalogSlug="DOS2"
      labels={{}}
    />,
  )
  assert.match(html, /<ul class="recipe-ingredients recipe-products">/)
  assert.ok(html.includes('href="/DOS2/short-stick"') && html.includes('href="/DOS2/metal-scraps"'))
  assert.ok(html.includes("×2"))
})
