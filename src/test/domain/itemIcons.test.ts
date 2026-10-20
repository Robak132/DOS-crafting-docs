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
