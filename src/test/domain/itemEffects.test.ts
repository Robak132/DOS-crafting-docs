import assert from "node:assert/strict"
import { test } from "node:test"
import { Item } from "../../main/domain/item"
import { ItemRecipes } from "../../main/domain/itemList"
import { Recipe } from "../../main/domain/recipe"

test("saved recipe notes take precedence over exported effects, in the selected language", () => {
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
  assert.deepEqual(new ItemRecipes([row], item).effects("en"), ["+2 Wits"])
  assert.deepEqual(new ItemRecipes([row], item).effects("pl"), ["+2 Bystrość"])
})
