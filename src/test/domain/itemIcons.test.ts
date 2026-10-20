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

test("rechecked concrete items resolve from game Stats rather than ambiguous display names", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  for (const game of ["dos2", "dos2-overhaul"] as const) {
    for (const [name, icon] of Object.entries({
      "Love Grenade": "Item_GRN_Love",
      "Empty Bottle": "Item_GRN_Bottle",
      "Water Barrel": "Item_CONT_Barrel_Water_A",
      Shell: "Item_HAR_Shell_A",
      Lemonade: "Item_CON_Drink_Cup_A_Orange",
    })) {
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, "")
      assert.equal(sources[game][key]?.icon, icon, `${game}: ${name}`)
      assert.ok(resolveItemIcon(icons, game, { name, tags: [] }))
    }
  }
  const mod = sources["dos2-overhaul"]
  assert.equal(mod["2hwatermace"].icon, "TwoHandedMaceWater")
  assert.equal(mod.chaostwohandedmace.icon, "TwoHandedMaceChaos")
  assert.equal(mod.uniquerangertorso.icon, "Armor_Hunter_Upper")
  assert.equal(mod.beardofthedivine.icon, "Item_LOOT_Hair_A")
  assert.equal(mod.beardofthedivineskillbook.icon, "Item_BOOK_Spellbook_SkillCrafting_A")
  assert.notEqual(icons["dos2-overhaul"].beardofthedivine, icons["dos2-overhaul"].beardofthedivineskillbook)
  assert.equal(sources.dos1.clawedairwand.icon, "Item_WPN_Wand_B_Air")
  assert.equal(sources.dos1.woodenfirewand.icon, "Item_WPN_Wand_A_Fire")
})

test("recipe data stores corrected game labels directly", () => {
  const base = JSON.parse(fs.readFileSync("data/library/recipes/dos2.json", "utf8"))
  assert.ok(base.recipes.some((row: { result: { name: string } }) => row.result.name === "Lemonade"))
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8"))
  const names = new Set(
    source.recipes.flatMap((row: { result: { name: string }; ingredients: { name: string }[] }) =>
      [row.result, ...row.ingredients].map((item) => item.name),
    ),
  )
  for (const name of ["Unique Ranger Torso", "Blank Air Skillbook", "Face-ripper"]) assert.ok(names.has(name), name)
  for (const name of [
    "Unique Ranger Armor Upperbody",
    "Air Empty Skillbook",
    "Cup of lemonade",
    "Face Ripper (In case you missed it)",
  ])
    assert.ok(!names.has(name), name)
})

test("Cyan Dye uses the Jellyroom mushroom instead of a nonexistent Jellyfish item", () => {
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8"))
  const cyan = source.recipes.find((row: { result: { name: string } }) => row.result.name === "Cyan Dye")
  assert.ok(cyan)
  const mushroom = cyan.ingredients.find((item: { name: string }) => item.name === "Jellyroom")
  assert.ok(mushroom)
  assert.equal(mushroom.namePl, "Meduzowiec")
  assert.equal(mushroom.slug, "Skladniki/JELLYROOM")
  assert.equal(resolveItemIcon(icons, "dos2-overhaul", mushroom), icons["dos2-overhaul"].jellyroom)
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", mushroom))
  assert.ok(
    !source.recipes.some((row: { ingredients: { name: string }[] }) =>
      row.ingredients.some((item) => item.name === "Jellyfish"),
    ),
  )
  assert.equal(fs.existsSync("data/library/pages/Skladniki/JELLYFISH.json"), false)
})

test("seasonal Frost Staff uses the mod's Winter Staff name, icon and description", () => {
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8"))
  const recipe = source.recipes.find(
    (row: { result: { slug: string } }) => row.result.slug === "Przedmioty-wydarzen/FROST-STAFF",
  )
  assert.ok(recipe)
  assert.equal(recipe.result.name, "Winter Staff")
  assert.ok(recipe.result.tags.includes("Typ/Bron"))
  assert.ok(recipe.result.tags.includes("Typ/Przedmioty-wydarzen"))
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", recipe.result))
  assert.equal(resolveItemIcon(icons, "dos2", recipe.result), undefined)
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  assert.equal(sources["dos2-overhaul"].winterstaff.icon, "Winter_Staff_Frost")
  assert.equal(sources["dos2-overhaul"].winterstaff.stats, "WPN_Staff_Frost_Winter")
  const descriptions = JSON.parse(fs.readFileSync("data/itemDescriptions.json", "utf8"))
  assert.equal(
    descriptions["dos2-overhaul"].winterstaff.en,
    "This frost staff thrums with energy, waiting to serve your purpose.",
  )
  const page = JSON.parse(fs.readFileSync("data/library/pages/Przedmioty-wydarzen/FROST-STAFF.json", "utf8"))
  assert.equal(page.title, "Winter Staff")
})

test("crafted two-handed mace has its preview icon while upgrade inputs remain selectors", () => {
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8"))
  const result = source.recipes.find(
    (row: { result: { slug: string } }) => row.result.slug === "Bron/TWO-HANDED-MACE",
  )?.result
  assert.ok(result)
  assert.equal(result.name, "Crafted 2H Mace")
  assert.equal(result.selectorTag, undefined)
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", result))
  const provenance = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  assert.equal(provenance["dos2-overhaul"].crafted2hmace.icon, "Item_WPN_Human_Normal_WarHammer_B")
  assert.equal(provenance["dos2-overhaul"].crafted2hmace.stats, "WPN_Mace_2H")
  const groups = source.recipes
    .flatMap((row: { ingredients: { name: string; selectorTag?: string; tags: string[] }[] }) => row.ingredients)
    .filter((item: { selectorTag?: string }) => item.selectorTag === "TwoHandedMaces")
  assert.ok(groups.length >= 3)
  for (const group of groups) {
    assert.equal(group.name, "Two Handed Mace")
    assert.equal(resolveItemIcon(icons, "dos2-overhaul", group), undefined)
  }
})

test("Wand of Source retains its valid generated name and resolves the dragon-wand template", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  assert.equal(sources["dos2-overhaul"].wandofsource.stats, "WPN_CorpseHarvester_40_DragonWand")
  assert.equal(sources["dos2-overhaul"].wandofsource.template, "a7ae2513-4fa5-4013-a78d-9a5f2d3e465b")
  assert.equal(sources["dos2-overhaul"].wandofsource.icon, "Item_WPN_Humans_Wand_1H_A")
  const item = { name: "Wand of Source", tags: [] }
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", item))
  assert.equal(resolveItemIcon(icons, "dos2", item), undefined)
  const descriptions = JSON.parse(fs.readFileSync("data/itemDescriptions.json", "utf8"))
  assert.ok(descriptions["dos2-overhaul"].wandofsource.en.includes("It has source in it."))
  const effects = JSON.parse(fs.readFileSync("data/itemEffects.json", "utf8"))["dos2-overhaul"].wandofsource
  for (const effect of ["-1 Finesse", "+1 Memory", "+1 Single-Handed", "+1 Dual Wielding", "Creates a Source surface"])
    assert.ok(effects.en.includes(effect), effect)
})
