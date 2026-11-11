import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { ItemGroup, type ItemGroups } from "../../main/domain/itemGroup"
import { SearchQuery } from "../../main/domain/searchQuery"
import { tagHierarchy } from "../../main/domain/tagHierarchy"
import { Upgrade, type UpgradeData } from "../../main/domain/upgrade"

const upgrade = (effect: string, targetTags: string[], target = "Shield") =>
  new Upgrade({
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
const upgradesForItem = (upgrades: Upgrade[], tags: string[], slug?: string, groups?: ItemGroups) =>
  upgrades.filter((entry) => entry.appliesTo(tags, slug, groups))

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
  const gloves = upgrade("Crit", ["Gloves"], "#Mage-Gloves").with({
    targets: [{ name: "#Mage-Gloves", tags: [], groupId: "magegloves" }],
  })
  const groups = {
    magegloves: new ItemGroup({
      id: "magegloves",
      name: "#Mage-Gloves",
      members: [{ name: "Mage Gloves", slug: "mage-gloves", tags: ["Gloves"] }],
    }),
  }
  assert.deepEqual(upgradesForItem([gloves], ["Gloves"], "mage-gloves", groups), [gloves])
  assert.deepEqual(upgradesForItem([gloves], ["Gloves"], "bone-gloves", groups), [])
})

test("an item page lists the upgrades that take it as an ingredient, directly or through a group", () => {
  const essence = upgrade("Air Resistance", ["Shields"])
  const rune = upgrade("Armour", ["Armour"]).with({
    ingredients: [{ name: "#Small-Rune", tags: [], groupId: "smallrune" }],
  })
  const groups = {
    smallrune: new ItemGroup({
      id: "smallrune",
      name: "#Small-Rune",
      members: [{ name: "Small Air Rune", slug: "small-air-rune", tags: [] }],
    }),
  }
  const using = (slug: string, keys: string[]) =>
    [essence, rune].filter((entry) => entry.uses(slug, new Set(keys), groups)).map((entry) => entry.effect.en)
  assert.deepEqual(using("small-air-rune", []), ["Armour"])
  assert.deepEqual(using("air-essence", ["airessence"]), ["Air Resistance"])
})

test("upgrade search covers effect, target and ingredients in both languages", () => {
  const entry = upgrade("Air Resistance", ["Shields"])
  for (const query of ["air", "odpornosc", "shield", "esencja", "AIR essence"])
    assert.ok(entry.matches(new SearchQuery(query)), query)
  assert.ok(!entry.matches(new SearchQuery("fire")))
})

test("upgrades are stored as modifications, never as items", () => {
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    const source = JSON.parse(fs.readFileSync(`data/library/recipes/${game}.json`, "utf8"))
    assert.ok(!source.recipes.some((row: { result: { tags: string[] } }) => row.result.tags.includes("Upgrades")), game)
    for (const entry of source.upgrades as UpgradeData[]) {
      assert.ok(entry.targetTags.length > 0 && entry.targetTags.every((tag) => tagHierarchy.isCategory(tag)), entry.id)
      assert.ok(!entry.ingredients.includes(entry.target), entry.id)
    }
  }
  for (const name of ["dos1", "dos2", "dos2-co"]) {
    const pages = JSON.parse(fs.readFileSync(`data/library/pages/${name}.json`, "utf8")).pages
    assert.ok(!pages.some((page: { tags: string[] }) => page.tags.includes("Upgrades")), name)
  }
})
