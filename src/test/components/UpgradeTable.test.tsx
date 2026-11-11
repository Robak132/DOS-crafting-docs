import assert from "node:assert/strict"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { TagLabels } from "../../main/domain/tagLabels"
import { UpgradeTable } from "../../main/components/UpgradeTable"
import { Upgrade } from "../../main/domain/upgrade"

const upgrade = new Upgrade({
  id: "air",
  effect: { en: "Air Resistance", pl: "Odporność na powietrze" },
  target: { name: "#Most-Weapons", selectorTag: "Most-Weapons", tags: [] },
  targetTags: ["Weapons"],
  tags: ["DOS1", "Air-Resistance"],
  ingredients: [{ name: "Air Essence", namePl: "Esencja powietrza", slug: "air-essence", tags: [] }],
  requirements: "Crafting 5",
  notes: "",
  remarks: "Excludes wands",
  source: "Sheet A1",
})

test("upgrades are named after their effect, once, with a plain target label and linked ingredients", () => {
  const named = upgrade.with({ effect: { en: "Boosted Armor (+1) Strength", pl: "Wzmocnienie: pancerz (+1 Siła)" } })
  assert.equal(named.title("pl"), "Wzmocnienie: pancerz (+1 Siła)")
  assert.equal(named.title("en"), "Boosted Armor (+1) Strength")
  const html = renderToString(
    <UpgradeTable upgrades={[upgrade]} labels={new TagLabels()} game="dos1" showRequirements />,
  )
  assert.match(
    html,
    /<span class="item-lang-en">Boost: Air Resistance<\/span><span class="item-lang-pl">Wzmocnienie: Odporność na powietrze<\/span>/,
  )
  assert.match(html, /<span class="recipe-item">.*Most Weapons/)
  assert.ok(!html.includes("recipe-item-group"), "the target is not a group link")
  assert.match(html, /href="\/receptury\/air-essence"/)
  assert.ok(html.includes("Crafting 5") && html.includes("Excludes wands") && html.includes("Sheet A1"))
  assert.match(html, /data-filter-tag="Air-Resistance"/)
  assert.ok(!html.includes('data-filter-tag="DOS1"'))
})
