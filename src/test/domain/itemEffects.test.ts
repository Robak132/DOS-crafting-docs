import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { uniqueItemEffects } from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

test("exported game effects preserve language and existing recipe effects", () => {
  const effects = JSON.parse(fs.readFileSync("data/itemEffects.json", "utf8"))
  assert.ok(effects.dos2.jellyroom.en.includes("+5% air resistance"))
  assert.ok(effects.dos2.apple.en.includes("Restores 10% vitality"))
  assert.ok(effects["dos2-overhaul"].winterstaff.en.includes("Ice Breaker"))
  assert.equal(effects.dos2.winterstaff, undefined)
  assert.equal(effects.dos2.blankairskillbook, undefined)
  const item = { name: "Jellyroom", tags: [], effect: effects.dos2.jellyroom }
  assert.deepEqual(uniqueItemEffects([], "en", item), [item.effect.en])
  assert.deepEqual(uniqueItemEffects([], "pl", item), [item.effect.pl])
  const row: RecipeRow = {
    id: "one",
    result: item,
    ingredients: [],
    tags: [],
    notes: "+2 Wits",
    remarks: "",
    requirements: "",
    source: "",
  }
  assert.deepEqual(uniqueItemEffects([row], "en", item), ["+2 Wits"])
  assert.deepEqual(uniqueItemEffects([row], "pl", item), ["+2 Bystrość"])
})

test("disguised healing potions keep separate effects for their confirmed recipes", () => {
  const effects = JSON.parse(fs.readFileSync("data/itemEffects.json", "utf8"))
  const variants = effects.dos2.minorhealingpotion.recipes
  const normal = variants["Skladniki/MINOR-HEALING-POTION:Empty Potion Bottle+Penny Bun Mushroom"]
  const poisoned = variants["Skladniki/MINOR-HEALING-POTION:Small Poison Bottle+Red Fabric Dye"]
  assert.ok(normal.en.includes("Restores vitality"))
  assert.ok(!normal.en.includes("Poisoned"))
  assert.ok(poisoned.en.includes("Poisoned"))
  assert.ok(!poisoned.en.includes("Restores vitality"))
  assert.equal(effects.dos2.minorhealingpotion.en, undefined)
})
