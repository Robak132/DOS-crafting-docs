import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import { resolveItemIcon, type ItemIconMap } from "../../main/domain/itemIcons"

const icons: ItemIconMap = JSON.parse(fs.readFileSync("data/itemIcons.json", "utf8"))

test("inventory icons stay scoped to the game and ignore ingredient selectors", () => {
  const item = { name: "Minor Healing Potion", tags: [] }
  assert.ok(resolveItemIcon(icons, "dos1", item))
  assert.ok(resolveItemIcon(icons, "dos2", item))
  assert.notEqual(resolveItemIcon(icons, "dos1", item), resolveItemIcon(icons, "dos2", item))
  assert.equal(resolveItemIcon(icons, "dos2", { ...item, selectorTag: "Minor Healing Potion" }), undefined)
  assert.equal(resolveItemIcon(icons, "dos2", { name: "Unknown item", tags: [] }), undefined)
  assert.equal(
    resolveItemIcon(icons, "dos2", { name: "MINOR HEALING POTION", tags: [] }),
    resolveItemIcon(icons, "dos2", item),
  )
})

test("DOS2 exports only use Definitive Edition atlases and Overhaul also includes mod atlases", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  assert.ok(Object.values<{ atlas: string }>(sources.dos2).every((source) => source.atlas.startsWith("dos2/")))
  assert.ok(
    Object.values<{ atlas: string }>(sources["dos2-overhaul"]).some((source) => source.atlas.startsWith("overhaul/")),
  )
  for (const names of Object.values(icons)) {
    for (const icon of Object.values(names)) {
      const image = fs.readFileSync(icon.replace("data/icons/", "assets/item-icons/"))
      assert.equal(image.toString("ascii", 0, 4), "RIFF")
      assert.equal(image.toString("ascii", 8, 12), "WEBP")
    }
  }
})

test("Workshop icons resolve dye colors and catalog aliases to the actual mod templates", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))["dos2-overhaul"]
  const expected = {
    pastelreddye: "DyePastelRed",
    crimsondye: "DyeCrimson",
    arrowgrenadebag: "arrowbag",
    boartusks: "Item_LOOT_Tusk_A",
    uniquetenebriumbow: "Item_WPN_Blackrock_Bow_A",
    uniquetenebriummagicalshield: "Item_WPN_Blackrock_Shield_A",
    uniquetenebriumshield: "Item_WPN_Blackrock_Shield_B",
  }
  for (const [name, icon] of Object.entries(expected)) {
    assert.equal(sources[name]?.icon, icon, name)
    assert.ok(icons["dos2-overhaul"][name])
  }
  assert.notEqual(icons["dos2-overhaul"].pastelreddye, icons["dos2-overhaul"].reddye)
  assert.equal(icons.dos2.pastelreddye, undefined)
})

test("pastel dye recipe names resolve to the corresponding Workshop color", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))["dos2-overhaul"]
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8"))
  const recipes = source.recipes
  for (const color of ["Blue", "Green", "Navy", "Pink", "Red", "Turquoise", "Yellow"]) {
    const name = `Pastel ${color} Dye`
    const item = recipes.find((row: { result: { name: string } }) => row.result.name === name)?.result
    assert.ok(item, `${name} must exist in the recipe catalog`)
    assert.ok(resolveItemIcon(icons, "dos2-overhaul", item), name)
    assert.equal(sources[`pastel${color.toLowerCase()}dye`].icon, `DyePastel${color}`)
    assert.equal(resolveItemIcon(icons, "dos2", item), undefined)
  }
})

test("corrected game names have icons and raw frog legs retain the ingredient image", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  const expected = {
    jellyroom: "Item_CON_Herb_Mushroom_B",
    largepoisonbottle: "Item_CON_PotionII_A_Green_Large",
    ajarofmindmaggots: "Item_LOOT_Jar_MindMaggot_A",
    mindmaggotgrenade: "Item_GRN_MindMaggots",
    froglegs: "Corpse_Item_FrogLEgs",
    crocodilegloves: "Corpse_Gloves_Croc",
    uniquenecromancerboots: "Armor_Necro_Boots",
  }
  for (const [name, icon] of Object.entries(expected)) {
    assert.equal(sources["dos2-overhaul"][name]?.icon, icon, name)
  }
  assert.notEqual(icons["dos2-overhaul"].froglegs, icons["dos2-overhaul"].cookedfroglegs)
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    for (const name of ["Blank Air Skillbook", "Mortar And Pestle", "A Jar of Mind Maggots"]) {
      assert.ok(resolveItemIcon(icons, game, { name, tags: [] }), `${game}: ${name}`)
    }
  }
})

test("Definitive Edition story items resolve their displayed names and icons", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    const expected = {
      glowingidolofrebirth: "Item_QUEST_Resurrection_Idol_A",
      ashenidolofrebirth: "Item_QUEST_Resurrection_Idol_A_Inert",
      alertnessherbmix: "Item_QUEST_Herbmix_Alertness",
      bladeoftheswornbreaker: "Item_UNI_WPN_Ataraxians_Scythe_2H_A_Blade",
    }
    for (const [name, icon] of Object.entries(expected)) {
      assert.equal(sources[game][name]?.icon, icon, `${game}: ${name}`)
    }
  }
})

test("Nails use the final localized Stats name and their actual inventory icon", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    assert.equal(sources[game].nails?.icon, "Item_TOOL_Nails_A")
    assert.ok(resolveItemIcon(icons, game, { name: "Nails", namePl: "Gwoździe", tags: [] }))
  }
})

test("technical identifiers and abbreviated recipe labels resolve through game names", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    assert.equal(sources[game].yarn?.icon, "Item_LOOT_Yarn_A_Wool_A")
    assert.equal(sources[game].brokenangelicstatue?.icon, "Portrait_PUZ_Statue_Angel_Broken")
    assert.equal(sources[game].headofangelicstatue?.icon, "Item_PUZ_Statue_Angel_Head")
    assert.equal(sources[game].trapdisarmingkit?.icon, "Item_TOOL_TrapDisarmToolkit_A")
  }
  assert.ok(resolveItemIcon(icons, "dos1", { name: "Large Fire Resistance Potion", tags: [] }))
  assert.ok(resolveItemIcon(icons, "dos1", { name: "Drudenae", tags: [] }))
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", { name: "Ink Pot and Quill", tags: [] }))
})

test("game preview metadata supplies empty cups and named elemental weapon icons", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"]) {
    assert.equal(sources[game].emptycup?.icon, "Item_CON_Drink_Cup_A_Empty")
  }
  const expected = {
    "2hairaxe": "TwoHandedAxeAir",
    "2hfiremace": "TwoHandedMaceFire",
    "2hwatersword": "TwoHandedSwordWater",
    unique2hairsword: "UniqueSwordAir2H",
    holyblessedgrenade: "GrenadeBlessedHoly",
    shriekersoul: "Orb_Shadow",
  }
  for (const [name, icon] of Object.entries(expected)) {
    assert.equal(sources["dos2-overhaul"][name]?.icon, icon, name)
  }
})
