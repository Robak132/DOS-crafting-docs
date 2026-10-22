import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { UpgradeTable } from "../../main/components/UpgradeTable"
import type { RecipeUpgrade } from "../../main/domain/recipes"

const upgrade: RecipeUpgrade = {
  id: "air",
  effect: { en: "Air Resistance", pl: "Odporność na powietrze" },
  target: { name: "#Most-Weapons", selectorTag: "Most-Weapons", tags: [] },
  targetTags: ["Typ/Bron"],
  tags: ["DOS1", "Cechy/Odporność-na-powietrze"],
  ingredients: [{ name: "Air Essence", namePl: "Esencja powietrza", slug: "air-essence", tags: [] }],
  requirements: "Crafting 5",
  notes: "",
  remarks: "Excludes wands",
  source: "Sheet A1",
}

test("upgrades show the effect, a plain target label and linked ingredients", () => {
  const html = renderToString(<UpgradeTable upgrades={[upgrade]} labels={{}} game="dos1" showRequirements />)
  assert.match(
    html,
    /<span class="item-lang-en">Air Resistance<\/span><span class="item-lang-pl">Odporność na powietrze<\/span>/,
  )
  assert.match(html, /<span class="recipe-item">.*Most Weapons/)
  assert.ok(!html.includes("group="), "the target is not a group link")
  assert.match(html, /href="\/air-essence\?catalog=dos1"/)
  assert.ok(html.includes("Crafting 5") && html.includes("Excludes wands") && html.includes("Sheet A1"))
  assert.match(html, /data-filter-tag="Cechy\/Odporność-na-powietrze"/)
  assert.ok(!html.includes('data-filter-tag="DOS1"'))
})

test("an empty upgrade list says so", () => {
  assert.match(renderToString(<UpgradeTable upgrades={[]} labels={{}} game="dos2" />), /Brak ulepszeń/)
})
