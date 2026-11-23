import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { Item } from "../../main/domain/item"
import { ItemGroup, type ItemGroups } from "../../main/domain/itemGroup"
import { ItemGroupResolver } from "../../main/domain/itemGroupResolver"
import type { Recipe } from "../../main/domain/recipe"
import { SearchQuery } from "../../main/domain/searchQuery"
import { TagLabels } from "../../main/domain/tagLabels"
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
const effect = (row: Recipe) => row.result.effect?.en
const upgradesForItem = (upgrades: Upgrade[], tags: string[], slug?: string, groups?: ItemGroups) =>
  upgrades.flatMap((entry) => entry.recipes()).filter((row) => row.appliesTo(tags, slug, groups))

test("an item page lists the upgrades whose target covers its category", () => {
  const upgrades = [
    upgrade("Air Resistance", ["Shields"]),
    upgrade("Fire Damage", ["Weapons"], "Most Weapons"),
    upgrade("Bow Damage", ["Bows"], "Bow"),
  ]
  // A page stores only its leaf tag; "Weapons" covers it through the hierarchy.
  const bow = ["DOS1", "Bows"]
  assert.deepEqual(upgradesForItem(upgrades, bow).map(effect), ["Fire Damage", "Bow Damage"])
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
  assert.deepEqual(upgradesForItem([gloves], ["Gloves"], "mage-gloves", groups).map(effect), ["Crit"])
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
    [essence, rune]
      .flatMap((entry) => entry.recipes())
      .filter((row) => row.uses(slug, new Set(keys), groups))
      .map(effect)
  assert.deepEqual(using("small-air-rune", []), ["Armour"])
  assert.deepEqual(using("air-essence", ["airessence"]), ["Air Resistance"])
  // The item an upgrade is applied to is not used up.
  assert.deepEqual(using("shield", ["shield"]), [])
})

test("an upgrade resolved to several slots is one recipe per slot, applying through its groups only", () => {
  const ring = upgrade("Crit", ["Rings", "Amulets"], "#Ring-Or-Amulet").with({
    targets: [
      { name: "Ring", tags: [], groupId: "ring" },
      { name: "Amulet", tags: [] },
    ],
  })
  const groups = {
    ring: new ItemGroup({ id: "ring", name: "Ring", members: [{ name: "Ring", slug: "ring", tags: [] }] }),
  }
  assert.deepEqual(
    ring.recipes().map((row) => row.ingredients[0].name),
    ["Ring", "Amulet"],
  )
  assert.equal(upgradesForItem([ring], ["Rings"], "ring", groups).length, 1)
  assert.deepEqual(upgradesForItem([ring], ["Amulets"], "amulet", groups), [])
})

test("a qualified target keeps to the items its qualifier names, even when none are in the catalog", () => {
  const inventory = [
    new Item({ name: "Unique Geomancer Helmet", tags: ["Helmets"] }),
    new Item({ name: "Iron Helmet", tags: ["Helmets"] }),
    new Item({ name: "Trethon's Old Robes", tags: ["Chest-Armour"] }),
  ]
  const mage = upgrade("Blind Immunity", ["Helmets"], "Mage Helmet")
  const metal = upgrade("Armour", ["Chest-Armour"], "METAL CHEST")
  const targets = new ItemGroupResolver([], inventory).upgradeTargets([mage, metal])
  assert.deepEqual(
    targets[mage.id][0].members.map((item) => item.name),
    ["Unique Geomancer Helmet"],
  )
  assert.deepEqual(targets[metal.id][0].members, [])
})

test("upgrade search covers effect, target and ingredients in both languages", () => {
  const [row] = upgrade("Air Resistance", ["Shields"]).recipes()
  const found = (query: string) => row.matches(new SearchQuery(query), new TagLabels(), "all")
  for (const query of ["air", "odpornosc", "shield", "esencja", "AIR essence"]) assert.ok(found(query), query)
  assert.ok(!found("fire"))
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
