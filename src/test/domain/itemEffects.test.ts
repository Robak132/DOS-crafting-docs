import assert from "node:assert/strict"
import { test } from "node:test"
import { uniqueItemEffects } from "../../main/domain/recipeView"
import type { RecipeRow } from "../../main/domain/recipes"

test("saved recipe notes take precedence over exported effects, in the selected language", () => {
  const item = { name: "Jellyroom", tags: [], effect: { en: "+5% air resistance", pl: "+5% odporności na powietrze" } }
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
