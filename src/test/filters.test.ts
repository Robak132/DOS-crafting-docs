import assert from "node:assert/strict"
import { test } from "node:test"
import {
  cycleFilter,
  emptyFilters,
  filterRecipes,
  filterUpgrades,
  filtersToSearch,
  rememberedCatalogHref,
  restoreFilters,
} from "../main/filters"
import type { RecipeRow, RecipeUpgrade } from "../main/domain/recipes"
const recipe: RecipeRow = {
  id: "one",
  result: { name: "Potion", namePl: "Mikstura", tags: ["Potions"] },
  ingredients: [{ name: "Herb", selectorTag: "Plants", tags: ["Materialy"] }],
  tags: ["Potions"],
  requirements: "Crafting 2",
  notes: "+2 Wits",
  remarks: "",
  source: "",
}
test("category selections coexist and cycle independently through include, exclude and neutral", () => {
  const bow = "Bows"
  const staff = "Staves"
  const selected = cycleFilter(cycleFilter(emptyFilters(), bow), staff)
  assert.deepEqual(selected.include, [bow, staff])
  assert.deepEqual(restoreFilters("dos2", filtersToSearch(selected, "items")), selected)
  const excluded = cycleFilter(selected, bow)
  assert.deepEqual(excluded.include, [staff])
  assert.deepEqual(excluded.exclude, [bow])
  const cleared = cycleFilter(excluded, bow)
  assert.deepEqual(cleared.include, [staff])
  assert.deepEqual(cleared.exclude, [])
  assert.deepEqual(selected.include, [bow, staff])
})

test("categories match any selection while traits and exclusions still narrow the results", () => {
  const row = (name: string, tags: string[]): RecipeRow => ({
    ...recipe,
    id: name,
    result: { name, tags },
  })
  const bow = row("Bow", ["Bows", "Ogien", "Strength"])
  const staff = row("Staff", ["Staves", "Ogien", "Strength"])
  const plainStaff = row("Plain Staff", ["Staves", "Strength"])
  const weakStaff = row("Weak Staff", ["Staves", "Ogien"])
  const boots = row("Boots", ["Boots", "Ogien", "Strength"])
  const recipes = [bow, staff, plainStaff, weakStaff, boots]
  const filters = { ...emptyFilters(), include: ["Bows", "Staves"] }
  assert.deepEqual(filterRecipes(recipes, filters, {}), [bow, staff, plainStaff, weakStaff])
  assert.deepEqual(filterRecipes(recipes, { ...filters, include: [...filters.include, "Ogien", "Strength"] }, {}), [
    bow,
    staff,
  ])
  assert.deepEqual(filterRecipes(recipes, { ...filters, exclude: ["Staves"] }, {}), [bow])
  assert.deepEqual(filterRecipes(recipes, { ...filters, include: ["Weapons"], exclude: ["Bows"] }, {}), [
    staff,
    plainStaff,
    weakStaff,
  ])
})
test("filters apply to result tags, effects, ingredients and crafting level", () => {
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), include: ["Potions"] }, {}).length, 1)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), include: ["Materialy"] }, {}).length, 0)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), query: "Bystrość" }, {}).length, 1)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), query: "Herb", scope: "ingredient" }, {}).length, 1)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), craftingMax: 1 }, {}).length, 0)
  assert.equal(filterRecipes([recipe], { ...emptyFilters(), selectors: ["Plants"], scope: "ingredient" }, {}).length, 1)
})
test("shareable filters roundtrip, while DOS2 drops DOS1-only requirements", () => {
  const filters = {
    ...emptyFilters(),
    query: "Healing Potion",
    exclude: ["Ogien"],
    craftingMax: 3,
    requirements: ["Crafting 2"],
  }
  assert.deepEqual(restoreFilters("dos1", filtersToSearch(filters, "recipes")), filters)
  assert.equal(restoreFilters("dos2", filtersToSearch(filters, "items")).craftingMax, null)
  assert.deepEqual(restoreFilters("dos2", filtersToSearch(filters, "items")).requirements, [])
  assert.deepEqual(restoreFilters("dos2", "?tag=Potions").include, ["Potions"])
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

test("tags are selected through filters, never through hashtag query syntax", () => {
  const tagged = { ...recipe, result: { ...recipe.result, tags: ["Ingredients"] } }
  assert.equal(filterRecipes([tagged], { ...emptyFilters(), include: ["Ingredients"] }, {}).length, 1)
  for (const scope of ["result", "ingredient"] as const)
    assert.equal(filterRecipes([tagged], { ...emptyFilters(), query: "#Typ/Skladniki", scope }, {}).length, 0)
})

test("catalog navigation restores each game's filters while explicit empty views still reset them", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  const saved = {
    dos1: { ...emptyFilters(), query: "Apple", craftingMax: 2 },
    dos2: { ...emptyFilters(), query: "Potion", include: ["Ingredients"], group: "fish" },
  }
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: (key: string) => JSON.stringify(saved[key.split(".").at(-1) as keyof typeof saved]) },
  })
  try {
    for (const game of ["dos1", "dos2"] as const) {
      const href = rememberedCatalogHref(game, "items")
      assert.deepEqual(restoreFilters(game, new URL(href, "https://example.test").search), saved[game])
      assert.deepEqual(restoreFilters(game, "?view=items"), emptyFilters())
    }
    const active = { ...saved.dos2, query: "Unsaved change" }
    const back = rememberedCatalogHref("dos2", "recipes", active)
    assert.deepEqual(restoreFilters("dos2", new URL(back, "https://example.test").search), active)
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
  }
})

test("hand-edited or corrupted stored filters fall back to safe values instead of crashing", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  const stored = {
    include: "Weapons",
    exclude: null,
    requirements: [1, "Crafting 2"],
    requirementsExclude: {},
    craftingMax: 99,
    scope: "everything",
    selectors: "Plants",
    query: 42,
    group: ["x"],
  }
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(stored) },
  })
  try {
    const filters = restoreFilters("dos1")
    assert.deepEqual(filters, { ...emptyFilters(), requirements: ["Crafting 2"] })
    assert.doesNotThrow(() => filterRecipes([recipe], filters, {}))
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
  }
})

test("upgrade view filters by target category, granted traits, requirements and query", () => {
  const upgrade = (id: string, targetTags: string[], tags: string[], requirements = ""): RecipeUpgrade => ({
    id,
    effect: { en: id },
    target: { name: "Target", tags: [] },
    targetTags,
    tags,
    ingredients: [],
    requirements,
    notes: "",
    remarks: "",
    source: "",
  })
  const all = [
    upgrade("weapons fire", ["Weapons"], ["Fire-Damage"], "Crafting 5"),
    upgrade("bow finesse", ["Bows"], ["Finesse"]),
    upgrade("shield air", ["Shields"], ["Air-Resistance"], "Crafting 4"),
  ]
  const ids = (filters: Partial<ReturnType<typeof emptyFilters>>) =>
    filterUpgrades(all, { ...emptyFilters(), ...filters }).map((entry) => entry.id)
  assert.deepEqual(ids({ include: ["Bows"] }), ["weapons fire", "bow finesse"])
  // Shields sit under Weapons in the tag tree.
  assert.deepEqual(ids({ include: ["Weapons"] }), ["weapons fire", "bow finesse", "shield air"])
  assert.deepEqual(ids({ include: ["Finesse"] }), ["bow finesse"])
  assert.deepEqual(ids({ exclude: ["Shields"] }), ["weapons fire", "bow finesse"])
  assert.deepEqual(ids({ craftingMax: 4 }), ["bow finesse", "shield air"])
  assert.deepEqual(ids({ query: "AIR" }), ["shield air"])
})
