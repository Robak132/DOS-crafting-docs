import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { buildCatalogs } from "../../main/domain/recipeCatalog"
import { itemDataKey, resolveItemIcon, type ItemIconMap } from "../../main/domain/itemIcons"
import { buildTooltipIndex } from "../../main/domain/tooltipIndex"
import { itemNameKeys, recipeUsesItem } from "../../main/domain/recipeView"

const read = (path: string) => JSON.parse(fs.readFileSync(path, "utf8"))

test("container and wearable Backpacks retain separate game identities in the combined catalog", () => {
  const sources = Object.fromEntries(
    ["dos1", "dos2", "dos2-overhaul"].map((game) => [game, read(`data/library/recipes/${game}.json`).recipes]),
  ) as Parameters<typeof buildCatalogs>[0]
  const catalog = buildCatalogs(sources, [], {})["dos2-overhaul"]
  const backpacks = catalog.recipes.filter((row) => row.result.name === "Backpack")
  assert.equal(backpacks.length, 2)
  const container = backpacks.find((row) => row.result.statsId === "CONT_Backpack_A")!
  const wearable = backpacks.find((row) => row.result.statsId === "ARM_Backpack")!
  assert.ok(container)
  assert.ok(wearable)
  assert.equal(container.result.slug, "Wyposazenie/BACKPACK")
  assert.equal(wearable.result.slug, "Amulety/BACKPACK")
  assert.equal(container.ingredients.length, 2)
  assert.equal(wearable.ingredients.length, 5)
  assert.ok(!container.result.tags.includes("Typ/Amulety"))
  assert.ok(wearable.result.tags.includes("Typ/Amulety"))
  const index = buildTooltipIndex(catalog.recipes)
  assert.deepEqual(index.recipesFor(container.result), [container])
  assert.deepEqual(index.recipesFor(wearable.result), [wearable])
  assert.equal(index.find(container.result.slug!, "Backpack"), container.result)
  assert.equal(index.find(wearable.result.slug!, "Backpack"), wearable.result)

  const icons = read("data/itemIcons.json") as ItemIconMap
  assert.notEqual(
    resolveItemIcon(icons, "dos2-overhaul", container.result),
    resolveItemIcon(icons, "dos2-overhaul", wearable.result),
  )
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", container.result))
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", wearable.result))
  const descriptions = read("data/itemDescriptions.json")["dos2-overhaul"]
  assert.ok(!descriptions[itemDataKey(container.result)].en.includes("wearable"))
  assert.ok(descriptions[itemDataKey(wearable.result)].en.includes("wearable"))
  const effects = read("data/itemEffects.json")["dos2-overhaul"]
  assert.equal(effects[itemDataKey(container.result)], undefined)
  assert.ok(effects[itemDataKey(wearable.result)].en.includes("+1 Initiative"))
  assert.equal(
    recipeUsesItem({ ...container, ingredients: [wearable.result] }, container.result.slug, itemNameKeys("Backpack")),
    false,
  )
})

test("the mod's Unique Pyromancer Belt uses its game recipe name, icon and effects", () => {
  const source = read("data/library/recipes/dos2-overhaul.json")
  const recipe = source.recipes.find(
    (row: { result: { slug?: string } }) => row.result.slug === "Pasy/UNIQUE-PYROKINETIC-BELT",
  )
  assert.ok(recipe)
  assert.equal(recipe.result.name, "Unique Pyromancer Belt")
  assert.equal(read("data/library/pages/Pasy/UNIQUE-PYROKINETIC-BELT.json").title, recipe.result.name)
  assert.deepEqual(
    recipe.ingredients.map((item: { name: string }) => item.name),
    ["Crafter's Workbench", "Fire Essence", "Rune Of Uniqueness", "Empty Magical Armour Belt"],
  )
  const key = itemDataKey(recipe.result)
  const provenance = read("data/itemIcons.provenance.json")["dos2-overhaul"][key]
  assert.equal(provenance.icon, "FireBelt")
  assert.equal(provenance.stats, "ARM_Belt_Empty_Magical_Fire")
  const icons = read("data/itemIcons.json") as ItemIconMap
  const icon = resolveItemIcon(icons, "dos2-overhaul", recipe.result)!
  assert.ok(icon)
  assert.ok(fs.existsSync(icon.replace("data/icons/", "assets/item-icons/")))
  const effect = read("data/itemEffects.json")["dos2-overhaul"][key]
  for (const bonus of [
    "+1 Intelligence",
    "+1 Memory",
    "+1 Pyrokinetic",
    "+1 Telekinesis",
    "+1 Loremaster",
    "Magic armour",
  ])
    assert.ok(effect.en.includes(bonus), bonus)
  assert.ok(recipe.result.tags.includes("Cechy/Pancerz-magiczny"))
  assert.ok(recipe.result.tags.includes("Typ/Pasy"))
  assert.ok(read("data/itemDescriptions.json")["dos2-overhaul"][key].en.includes("belt"))
  assert.equal(read("data/itemIcons.json").dos2[key], undefined)
})

test("masked quest potions show game names while preserving their distinct effects and crafting recipes", () => {
  const sources = Object.fromEntries(
    ["dos1", "dos2", "dos2-overhaul"].map((game) => [game, read(`data/library/recipes/${game}.json`).recipes]),
  ) as Parameters<typeof buildCatalogs>[0]
  const icons = read("data/itemIcons.json") as ItemIconMap
  const exportedEffects = read("data/itemEffects.json")
  const descriptions = read("data/itemDescriptions.json")
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    const catalog = buildCatalogs(sources, [], {})[game]
    const index = buildTooltipIndex(catalog.recipes)
    const variants = [
      [
        "POTION_Healing_Poisoned_Masked_Void_A",
        "Specjalne/POTION_HEALING_POISONED_MASKED_VOID_A",
        "Large healing potion",
        "Duża mikstura uzdrawiająca",
        "Poisoned",
      ],
      [
        "CON_Potion_Healing_WitchPotion_Masked",
        "Specjalne/POTION_HEALING_WITCHPOTION_MASKED",
        "Huge Healing Potion",
        "Wielka mikstura uzdrawiająca",
        "Cow",
      ],
    ]
    for (const [statsId, slug, name, namePl, effect] of variants) {
      const recipe = catalog.recipes.find((row) => row.result.slug === slug)!
      assert.ok(recipe)
      assert.equal(recipe.result.statsId, statsId)
      assert.ok(recipe.result.name.toLowerCase().startsWith(name.toLowerCase() + " ("))
      assert.ok(recipe.result.namePl?.startsWith(namePl + " ("))
      assert.ok(recipe.result.tags.includes("Typ/Mikstury-i-jedzenie"))
      const key = itemDataKey(recipe.result)
      assert.ok(exportedEffects[game][key].en.includes(effect))
      assert.ok(descriptions[game][key].en.includes("potion"))
      assert.ok(resolveItemIcon(icons, game, recipe.result))
      assert.deepEqual(index.recipesFor(recipe.result), [recipe])
      const normal = catalog.recipes.find(
        (row) =>
          row.result.name.toLowerCase() === name.toLowerCase() && row.result.slug !== slug && !row.result.statsId,
      )
      if (normal) {
        assert.ok(!index.recipesFor(normal.result).includes(recipe))
        assert.ok(!recipeUsesItem({ ...recipe, ingredients: [normal.result] }, slug, itemNameKeys(name)))
      }
    }
  }
})

test("audited crafted and seasonal weapons have verified Stats, damage effects, subtypes and icons", () => {
  const definitions = [
    ["Bron/BOW", "WPN_Bow", "Crafted Bow", "Luki"],
    ["Narzedzia/DAGGER", "WPN_Dagger", "Crafted Dagger", "Sztylety"],
    ["Bron/SPEAR", "WPN_Spear", "Crafted Spear", "Wlocznie"],
    ["Bron/SWORD", "WPN_Sword_1H", "Crafted Sword", "Miecze"],
    ["Bron/TWO-HANDED-AXE", "WPN_Axe_2H", "Crafted 2H Axe", "Topory"],
    ["Bron/TWO-HANDED-SWORD", "WPN_Sword_2H", "Crafted 2H Sword", "Miecze"],
    ["Magia/POISON-STAFF", "WPN_Staff_Poison", "Posion Staff", "Kostury"],
    ["Magia/UNIQUE-POISON-STAFF", "WPN_Staff_Unique_Poison", "Unique Posion Staff", "Kostury"],
    ["Przedmioty-wydarzen/BROOM-STAFF", "WPN_Spooky_Broom_Staff", "Witch Broom", "Kostury"],
    ["Przedmioty-wydarzen/REAPER'S-SCYTHE", "WPN_Spooky_Reaper_Scythe", "Halloween Reaper's Scythe", "Topory"],
    ["Skladniki/THE-MISTAKE-STAFF", "WPN_CorpseHarvester_57_MistakeStaff", "The Mistake", "Kostury"],
  ]
  const source = read("data/library/recipes/dos2-overhaul.json").recipes
  const icons = read("data/itemIcons.json") as ItemIconMap
  const effects = read("data/itemEffects.json")["dos2-overhaul"]
  for (const [slug, statsId, name, subtype] of definitions) {
    const item = source.find((r: { result: { slug: string } }) => r.result.slug === slug).result
    assert.equal(item.name, name)
    assert.equal(item.statsId, statsId)
    assert.ok(item.tags.includes(`Typ/Bron/${subtype}`), name)
    const icon = resolveItemIcon(icons, "dos2-overhaul", item)!
    assert.ok(icon, name)
    assert.ok(fs.existsSync(icon.replace("data/icons/", "assets/item-icons/")))
    assert.ok(effects[itemDataKey(item)].en.includes("damage (scales with item level)"), name)
  }
  assert.ok(effects.wpnstaffpoison.en.includes("poison damage"))
  assert.ok(!effects.wpnstaffpoison.en.includes("fire damage"))
  assert.ok(effects.wpnspookyreaperscythe.en.includes("earth damage"))
  assert.ok(effects.wpnspookybroomstaff.en.includes("physical damage"))
})

test("Makeshift Club recipes distinguish the one-handed and two-handed outputs", () => {
  const source = read("data/library/recipes/dos2.json").recipes
  const clubs = source.filter((r: { result: { name: string } }) => r.result.name === "Makeshift Club")
  assert.equal(clubs.length, 3)
  for (const recipe of clubs) {
    const one = recipe.ingredients.some((item: { name: string }) => item.name === "Sharp Rock")
    assert.equal(recipe.result.statsId, one ? "WPN_Common_Mace_1H_C" : "WPN_CraftedMace_2H")
    assert.equal(recipe.result.slug, one ? "Bron/MAKESHIFT-CLUB-ONE-HANDED" : "Bron/MAKESHIFT-CLUB")
    assert.equal(recipe.result.nameQualifier.pl, one ? "jednoręczna" : "dwuręczna")
    assert.ok(recipe.result.tags.includes("Typ/Bron/Bulawy"))
  }
})
