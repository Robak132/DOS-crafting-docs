import assert from "node:assert/strict"
import { test } from "node:test"
import { ItemGroup } from "../../main/domain/itemGroup"
import { SuggestionIndex } from "../../main/domain/searchSuggestions"

const index = new SuggestionIndex(
  [
    { name: "Air Essence", namePl: "Esencja powietrza", slug: "air-essence", tags: [] },
    { name: "Fire Essence", namePl: "Esencja ognia", slug: "fire-essence", tags: [] },
    { name: "Air Essence", namePl: "Esencja powietrza", slug: "air-essence", tags: [] },
    { name: "#Small-Rune", selectorTag: "Small-Rune", tags: [] },
  ],
  { smallrune: new ItemGroup({ id: "smallrune", name: "#Small-Rune", members: [] }) },
)

test("suggestions match English and Polish names, best fit first, once each", () => {
  assert.deepEqual(
    index.suggest("ess").map((entry) => entry.en),
    ["Air Essence", "Fire Essence"],
  )
  assert.deepEqual(
    index.suggest("powie").map((entry) => entry.en),
    ["Air Essence"],
  )
  assert.deepEqual(
    index.suggest("fire").map((entry) => entry.en),
    ["Fire Essence"],
  )
  assert.deepEqual(index.suggest("Air Essence"), [])
})

test("a # asks for groups, which complete to their search token", () => {
  assert.deepEqual(index.suggest("small"), [])
  assert.deepEqual(
    index.suggest("#sma").map((entry) => entry.token),
    ['#"Small Rune"'],
  )
})
