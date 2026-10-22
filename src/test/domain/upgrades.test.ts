import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { matchesUpgradeQuery, upgradeEffect, upgradesForItem } from "../../main/domain/upgrades"
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
    upgrade("Air Resistance", ["Typ/Pancerz/Tarcze"]),
    upgrade("Fire Damage", ["Typ/Bron"], "Most Weapons"),
    upgrade("Bow Damage", ["Typ/Bron/Luki"], "Bow"),
  ]
  const bow = ["DOS1", "Typ", "Typ/Bron", "Typ/Bron/Luki"]
  assert.deepEqual(
    upgradesForItem(upgrades, bow).map((entry) => entry.effect.en),
    ["Fire Damage", "Bow Damage"],
  )
  assert.deepEqual(upgradesForItem(upgrades, ["Typ", "Typ/Skladniki"]), [])
})

test("upgrade search covers effect, target and ingredients in both languages", () => {
  const entry = upgrade("Air Resistance", ["Typ/Pancerz/Tarcze"])
  for (const query of ["air", "odpornosc", "shield", "esencja", "AIR essence"])
    assert.ok(matchesUpgradeQuery(entry, query), query)
  assert.ok(!matchesUpgradeQuery(entry, "fire"))
  assert.equal(upgradeEffect(entry, "pl"), "Odporność na powietrze")
  assert.equal(upgradeEffect(upgrade("Wits", []), "pl"), "Wits")
})

test("upgrades are stored as modifications, never as items", () => {
  let total = 0
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    const source = JSON.parse(fs.readFileSync(`data/library/recipes/${game}.json`, "utf8"))
    assert.ok(
      !source.recipes.some((row: { result: { tags: string[] } }) => row.result.tags.includes("Typ/Ulepszenia")),
      game,
    )
    for (const entry of source.upgrades as RecipeUpgrade[]) {
      assert.ok(entry.targetTags.length > 0 && entry.targetTags.every((tag) => tag.startsWith("Typ/")), entry.id)
      assert.ok(!entry.ingredients.includes(entry.target), entry.id)
    }
    total += source.upgrades.length
  }
  assert.equal(total, 191)
  for (const name of ["dos1", "dos2", "dos2-co"]) {
    const pages = JSON.parse(fs.readFileSync(`data/library/pages/${name}.json`, "utf8")).pages
    assert.ok(!pages.some((page: { tags: string[] }) => page.tags.includes("Typ/Ulepszenia")), name)
  }
})

test("Boosted Amulets and Rings are crafted items, not upgrades", () => {
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8"))
  const boosted = source.recipes.filter((row: { result: { name: string } }) =>
    /^Boosted (Amulet|Ring) \(/.test(row.result.name),
  )
  assert.equal(boosted.length, 24)
  for (const row of boosted) {
    const category = row.result.name.startsWith("Boosted Amulet") ? "Typ/Amulety" : "Typ/Pierscienie"
    assert.ok(row.result.tags.includes(category), row.id)
  }
  assert.ok(!source.upgrades.some((entry: RecipeUpgrade) => /^Boosted (Amulet|Ring) \(/.test(entry.effect.en)))
})
