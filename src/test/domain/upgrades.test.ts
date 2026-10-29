import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { matchesUpgradeQuery, upgradesForItem } from "../../main/domain/upgrades"
import { isCategoryTag } from "../../main/domain/tagTree"
import type { RecipeUpgrade } from "../../main/domain/recipes"

const upgrade = (effect: string, targetTags: string[], target = "Shield"): RecipeUpgrade => ({
  id: effect,
  effect: { en: effect, pl: effect === "Air Resistance" ? "Odporność na powietrze" : undefined },
  target: { name: target, tags: [] },
  targetTags,
  tags: [],
  ingredients: [{ name: "Air Essence", namePl: "Esencja powietrza", tags: [] }],
  requirements: "",
  notes: "",
  remarks: "",
  source: "",
})

test("an item page lists the upgrades whose target covers its category", () => {
  const upgrades = [
    upgrade("Air Resistance", ["Shields"]),
    upgrade("Fire Damage", ["Weapons"], "Most Weapons"),
    upgrade("Bow Damage", ["Bows"], "Bow"),
  ]
  // A page stores only its leaf tag; "Weapons" covers it through the hierarchy.
  const bow = ["DOS1", "Bows"]
  assert.deepEqual(
    upgradesForItem(upgrades, bow).map((entry) => entry.effect.en),
    ["Fire Damage", "Bow Damage"],
  )
  assert.deepEqual(upgradesForItem(upgrades, ["Ingredients"]), [])
})

test("an upgrade with a resolved target group applies only to that group's members", () => {
  const gloves = {
    ...upgrade("Crit", ["Gloves"], "#Mage-Gloves"),
    targets: [{ name: "#Mage-Gloves", tags: [], groupId: "magegloves" }],
  }
  const groups = {
    magegloves: {
      id: "magegloves",
      name: "#Mage-Gloves",
      members: [{ name: "Mage Gloves", slug: "mage-gloves", tags: ["Gloves"] }],
    },
  }
  assert.deepEqual(upgradesForItem([gloves], ["Gloves"], "mage-gloves", groups), [gloves])
  assert.deepEqual(upgradesForItem([gloves], ["Gloves"], "bone-gloves", groups), [])
})

test("upgrade search covers effect, target and ingredients in both languages", () => {
  const entry = upgrade("Air Resistance", ["Shields"])
  for (const query of ["air", "odpornosc", "shield", "esencja", "AIR essence"])
    assert.ok(matchesUpgradeQuery(entry, query), query)
  assert.ok(!matchesUpgradeQuery(entry, "fire"))
})

test("upgrades are stored as modifications, never as items", () => {
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    const source = JSON.parse(fs.readFileSync(`data/library/recipes/${game}.json`, "utf8"))
    assert.ok(!source.recipes.some((row: { result: { tags: string[] } }) => row.result.tags.includes("Upgrades")), game)
    for (const entry of source.upgrades as RecipeUpgrade[]) {
      assert.ok(entry.targetTags.length > 0 && entry.targetTags.every(isCategoryTag), entry.id)
      assert.ok(!entry.ingredients.includes(entry.target), entry.id)
    }
  }
  for (const name of ["dos1", "dos2", "dos2-co"]) {
    const pages = JSON.parse(fs.readFileSync(`data/library/pages/${name}.json`, "utf8")).pages
    assert.ok(!pages.some((page: { tags: string[] }) => page.tags.includes("Upgrades")), name)
  }
})
