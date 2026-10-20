import assert from "node:assert/strict"
import { test } from "node:test"
import { emptyFilters, filterRecipes, filtersToSearch, restoreFilters } from "../main/filters"
import type { RecipeRow } from "../main/domain/recipes"
const recipe: RecipeRow = {
  id: "one",
  result: { name: "Potion", namePl: "Mikstura", tags: ["Typ/Mikstury"] },
  ingredients: [{ name: "Herb", selectorTag: "Plants", tags: ["Typ/Materialy"] }],
  tags: ["Typ/Mikstury"],
  requirements: "Crafting 2",
  notes: "+2 Wits",
  remarks: "",
  source: "",
}
test("filters apply to result tags, effects, ingredients and crafting level", () => {
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), include: ["Typ/Mikstury"] }, {}).length, 1)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), include: ["Typ/Materialy"] }, {}).length, 0)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), query: "Bystrość" }, {}).length, 1)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), query: "Herb", scope: "ingredient" }, {}).length, 1)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), craftingMax: 1 }, {}).length, 0)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), selectors: ["Plants"], scope: "ingredient" }, {}).length, 1)
})
test("shareable filters roundtrip, while DOS2 drops DOS1-only requirements", () => {
  const filters = {
    ...emptyFilters(),
    query: "Healing Potion",
    exclude: ["Cechy/Ogien"],
    craftingMax: 3,
    requirements: ["Crafting 2"],
  }
  assert.deepEqual(restoreFilters("dos1", filtersToSearch(filters, "recipes")), filters)
  assert.equal(restoreFilters("dos2", filtersToSearch(filters, "items")).craftingMax, null)
  assert.deepEqual(restoreFilters("dos2", filtersToSearch(filters, "items")).requirements, [])
  assert.deepEqual(restoreFilters("dos2", "?tag=Typ%2FMikstury").include, ["Typ/Mikstury"])
})

test("group selection survives a shareable URL and clearing filters removes it", () => {
  const filters = { ...emptyFilters(), group: "cloth-gloves" }
  assert.deepEqual(restoreFilters("dos2-overhaul", filtersToSearch(filters, "items")), filters)
  assert.equal(restoreFilters("dos2-overhaul", "?view=items").group, null)
})

test("browser back to an explicit unfiltered view does not restore the previous group from storage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify({ ...emptyFilters(), group: "fish" }) },
  })
  try {
    assert.equal(restoreFilters("dos2", "?view=recipes").group, null)
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
  }
})
