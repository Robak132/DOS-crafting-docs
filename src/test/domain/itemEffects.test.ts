import assert from "node:assert/strict"
import { test } from "node:test"
import { EffectNote } from "../../main/domain/effectNote"
import { Item } from "../../main/domain/item"
import { ItemRecipes } from "../../main/domain/itemList"
import { Recipe } from "../../main/domain/recipe"

test("the game's exported effects take precedence over saved notes, which only fill in for missing game data", () => {
  const effect = { en: "+5% air resistance", pl: "+5% odporności na powietrze" }
  const item = new Item({ name: "Jellyroom", tags: [], effect })
  assert.deepEqual(new ItemRecipes([], item).effects("en"), [effect.en])
  assert.deepEqual(new ItemRecipes([], item).effects("pl"), [effect.pl])
  const row = new Recipe({
    id: "one",
    result: item,
    ingredients: [],
    tags: [],
    notes: "+2 Wits",
    remarks: "",
    requirements: "",
    source: "",
  })
  assert.deepEqual(new ItemRecipes([row], item).effects("en"), [effect.en])
  const unknown = row.with({ result: item.with({ effect: undefined }) })
  assert.deepEqual(new ItemRecipes([unknown], unknown.result).effects("en"), ["+2 Wits"])
  assert.deepEqual(new ItemRecipes([unknown], unknown.result).effects("pl"), ["+2 Bystrość"])
})

test("percentages read as +N% in both languages, with the Polish genitive", () => {
  assert.equal(new EffectNote("+10% Heal, +15% Air Resist").polish(), "+10% leczenia, +15% odporności na powietrze")
})
