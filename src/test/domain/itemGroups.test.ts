import assert from "node:assert/strict"
import { test } from "node:test"
import { GroupMatcher } from "../../main/domain/groupMatcher"
import { Item, type ItemData } from "../../main/domain/item"
import { ItemGroup, type ItemGroupData, type ItemGroups } from "../../main/domain/itemGroup"
import { ItemGroupResolver } from "../../main/domain/itemGroupResolver"
import { Recipe } from "../../main/domain/recipe"
import { SmallGroupExpander } from "../../main/domain/smallGroupExpander"

const compareNames = (a: string, b: string) => a.localeCompare(b, "en")
const item = (name: string, extra: Partial<ItemData> = {}) => new Item({ name, tags: [], ...extra })
const row = (result: Item, ingredients: Item[] = []) =>
  new Recipe({
    id: result.name,
    result,
    ingredients,
    tags: [],
    notes: "",
    remarks: "",
    source: "",
    requirements: "",
  })
const buildItemGroups = (recipes: Recipe[], minimumSize?: number, inventory: Item[] = []) =>
  new ItemGroupResolver(recipes, inventory).groups(minimumSize)
const groupsOf = (groups: Record<string, ItemGroupData>): ItemGroups =>
  Object.fromEntries(Object.entries(groups).map(([id, group]) => [id, new ItemGroup(group)]))
const expandSmallGroups = (recipes: Recipe[], groups: Record<string, ItemGroupData>) =>
  new SmallGroupExpander(groupsOf(groups)).expand(recipes)
const matcher = (definition: Item) => {
  const found = GroupMatcher.for(definition)
  return found && ((candidate: Item) => found.matches(candidate))
}

test("selector groups require four distinct members and include ingredients without icons or recipes", () => {
  const definition = item("#Fish", { selectorTag: "Fish" })
  const members = ["Salmon", "Herring", "Trout", "Mackerel"].map((name) => item(name))
  const recipes = [row(item("Dinner"), [definition, ...members.slice(0, 3)])]
  assert.deepEqual(buildItemGroups(recipes), {})
  recipes.push(row(members[0], [members[3], members[0]]))
  const groups = buildItemGroups(recipes)
  assert.equal(groups.fish.members.length, 4)
  const results = groups.fish.rows(recipes)
  assert.deepEqual(new Set(results.map((r) => r.result.name)), new Set(members.map((m) => m.name)))
  assert.equal(results.find((r) => r.result.name === "Salmon")?.id, "Salmon")
})

test("explicit alternatives form groups and material prefixes apply to every alternative", () => {
  const definition = item("Cloth Upperbody, Gloves, Boots, Helmet, Pants")
  const members = ["Cloth Shirt", "Cloth Gloves", "Cloth Boots", "Cloth Helmet"].map((name) => item(name))
  const groups = buildItemGroups([row(definition, [...members, item("Metal Boots")])])
  assert.equal(Object.values(groups)[0].members.length, 4)
  assert.ok(Object.values(groups)[0].members.every((m) => m.name.startsWith("Cloth")))
})

test("game categories distinguish skillbook schools; compound outputs and placeholders are not members", () => {
  const match = matcher(item("#Air-Skillbook", { selectorTag: "Air-Skillbook" }))!
  assert.equal(match(item("Teleportation Skillbook", { craftingCategories: ["AirSkillbook"] })), true)
  assert.equal(match(item("Fireball Skillbook", { craftingCategories: ["FireSkillbook"] })), false)
  assert.equal(matcher(item("Knife or Dagger"))!(item("Searing Daggers Scroll")), false)
  assert.equal(matcher(item("Wood Chips, Nails"))!(item("Wood Chips and Arrow Shaft")), false)
  assert.equal(
    matcher(
      item("#Small-Or-Medium-Or-Large-Or-Giant-Rune", { selectorTag: "Small-Or-Medium-Or-Large-Or-Giant-Rune" }),
    )!(item("Giant % Rune")),
    false,
  )
  assert.equal(matcher(item("ADD AIR, FIRE, WATER")), undefined)
})

test("equipment category ingredients and dyed results group the same slot without including placeholders", () => {
  const slots = [
    [
      "Body Armor",
      "Colored Body Armor",
      "Upperbody",
      ["Mage Robe", "Leather Shirt", "Plate Upperbody", "Warrior Body Armor"],
    ],
    ["Boots", "Colored Boots", "ArmorShoes", ["Leather Boots", "Bone Boots", "Pawed Boots", "Winged Boots"]],
    ["Cape", "Colored Cape", "Cape", ["Fancy Cape", "Ghost Cape", "Night Cape", "Unique Warrior Cape"]],
    ["Gloves", "Colored Gloves", "Gloves", ["Leather Gloves", "Bone Gloves", "Crocodile Gloves", "Troll Gloves"]],
    ["Helmet", "Colored Helmet", "Helmet", ["Leather Helmet", "Bone Helmet", "Witch Helmet", "Ghost Helm"]],
    [
      "Lowerbody Armor",
      "Colored Pants",
      "Pants",
      ["Leather Pants", "Bone Pants", "Djinn Pants", "Unique Warrior Armor Lowerbody"],
    ],
  ] as const
  for (const [ingredient, result, selectorTag, names] of slots) {
    const members = names.map((name) => item(name))
    const recipes = [
      row(item(result, { selectorTag }), [item(ingredient, { selectorTag }), item("#Dye", { selectorTag: "Dye" })]),
      ...members.map((member) => row(member, [item("Material")])),
      row(item("Unrelated"), [item(ingredient)]),
    ]
    const groups = Object.values(buildItemGroups(recipes))
    const input = groups.find((group) => group.name === ingredient)!
    const output = groups.find((group) => group.name === result)!
    assert.ok(input && output, `${ingredient} and ${result} must both be groups`)
    assert.deepEqual(input.members.map((member) => member.name).sort(compareNames), [...names].sort(compareNames))
    assert.deepEqual(output.members, input.members)
    assert.equal(output.rows(recipes).length, 4)
  }
  const helmet = matcher(item("Helmet", { selectorTag: "Helmet" }))!
  assert.equal(helmet(item("Unnamed headgear", { craftingCategories: ["Helmet"] })), true)
  assert.equal(helmet(item("Helmet-shaped Boots", { craftingCategories: ["ArmorShoes"] })), false)
})

test("groups of one, two and three members become concrete recipe variants, preserving quantities and metadata", () => {
  for (const count of [1, 2, 3]) {
    const members = ["Salmon", "Trout", "Herring"]
      .slice(0, count)
      .map((name) => item(name, { slug: name, icon: `${name}.webp` }))
    const source = row(item("Dinner"), [item("#Fish", { selectorTag: "Fish", quantity: "x2" }), item("Salt")]).with({
      notes: "Effect",
      remarks: "At oven",
      source: "Game",
      requirements: "Crafting 2",
    })
    const groups = { fish: { id: "fish", name: "#Fish", members } }
    const expanded = expandSmallGroups([source], groups)
    assert.equal(expanded.length, count)
    assert.equal(new Set(expanded.map((r) => r.id)).size, count)
    assert.deepEqual(
      expanded.map((r) => r.ingredients[0].name),
      members.map((m) => m.name),
    )
    for (const variant of expanded) {
      assert.equal(variant.ingredients[0].quantity, "x2")
      assert.equal(variant.ingredients[0].selectorTag, undefined)
      assert.equal(variant.ingredients[1].name, "Salt")
      assert.equal(variant.notes, source.notes)
      assert.equal(variant.remarks, source.remarks)
      assert.equal(variant.requirements, source.requirements)
      assert.deepEqual(variant.sourceRecipeIds, [source.id])
    }
    assert.equal(source.ingredients[0].name, "#Fish")
  }
})

test("multiple small groups expand into every combination, including alternative results", () => {
  const recipes = [row(item("Plate or Cup"), [item("Wood Chips, Nails"), item("#Fish", { selectorTag: "Fish" })])]
  const groups = {
    plateorcup: { id: "plateorcup", name: "Plate or Cup", members: [item("Plate"), item("Cup")] },
    woodchipsnails: { id: "woodchipsnails", name: "Wood Chips, Nails", members: [item("Wood Chips"), item("Nails")] },
    fish: { id: "fish", name: "#Fish", members: [item("Salmon"), item("Trout")] },
  }
  const expanded = expandSmallGroups(recipes, groups)
  assert.equal(expanded.length, 8)
  assert.equal(new Set(expanded.map((r) => `${r.result.name}:${r.ingredients.map((i) => i.name).join(":")}`)).size, 8)
  assert.equal(new Set(expanded.map((r) => r.id)).size, 8)
})

test("four-member and unresolved groups remain unchanged and expansion is idempotent", () => {
  const source = row(item("Dinner"), [item("#Fish", { selectorTag: "Fish" }), item("Unknown or Missing")])
  const groups = {
    fish: { id: "fish", name: "#Fish", members: ["Salmon", "Trout", "Herring", "Cod"].map((name) => item(name)) },
  }
  assert.deepEqual(expandSmallGroups([source], groups), [source])
  const small = { fish: { ...groups.fish, members: groups.fish.members.slice(0, 2) } }
  const expanded = expandSmallGroups([source], small)
  assert.deepEqual(expandSmallGroups(expanded, small), expanded)
})

test("expanded alternatives reuse an existing concrete recipe without duplicate rows or lost sources", () => {
  const original = row(item("Dinner"), [item("#Fish", { selectorTag: "Fish" })]).with({ source: "Group source" })
  const concrete = row(item("Dinner"), [item("Salmon")]).with({ id: "concrete", source: "Concrete source" })
  const groups = { fish: { id: "fish", name: "#Fish", members: [item("Salmon"), item("Trout")] } }
  for (const recipes of [
    [original, concrete],
    [concrete, original],
  ]) {
    const expanded = expandSmallGroups(recipes, groups)
    assert.equal(expanded.length, 2)
    const salmon = expanded.find((r) => r.ingredients[0].name === "Salmon")!
    assert.equal(salmon.id, "concrete")
    assert.deepEqual(new Set(salmon.sourceRecipeIds), new Set([original.id, concrete.id]))
    assert.ok(salmon.source.includes("Group source") && salmon.source.includes("Concrete source"))
    assert.deepEqual(expandSmallGroups(expanded, groups), expanded)
    assert.equal(concrete.source, "Concrete source")
  }
})

test("ingredient order does not duplicate concrete recipes or lose quantities, effects and sources", () => {
  const first = row(item("Pizza Dough"), [item("Dough", { quantity: "x2" }), item("Tomato Sauce")]).with({
    id: "first",
    source: "First source",
  })
  const second = first.with({
    id: "second",
    ingredients: [...first.ingredients].reverse(),
    source: "Second source",
    notes: "Heal",
    tags: ["Food"],
  })
  const before = JSON.stringify([first, second])
  const result = expandSmallGroups([first, second], {})
  assert.equal(result.length, 1)
  assert.deepEqual(result[0].ingredients, first.ingredients)
  assert.deepEqual(result[0].sourceRecipeIds, ["first", "second"])
  assert.equal(result[0].source, "First source; Second source")
  assert.equal(result[0].notes, "Heal")
  assert.ok(result[0].tags.includes("Food"))
  assert.deepEqual(expandSmallGroups(result, {}), result)
  assert.equal(JSON.stringify([first, second]), before)
})

test("deduplication keeps the localized alias instead of the first spelling", () => {
  const plain = row(item("Cloth Scraps"), [item("Bed Linen"), item("CuttingTool", { slug: "cuttingtool" })])
  const localized = plain.with({
    id: "localized",
    ingredients: [item("Bed Linen"), item("Cutting Tool", { slug: "cutting-tool", namePl: "Narzędzie do krojenia" })],
  })
  const duplicatePage = plain.with({
    id: "duplicate-page",
    ingredients: [item("Bed Linen"), item("Cutting Tool", { slug: "cutting-tool-2", namePl: "Narzędzie do krojenia" })],
  })
  for (const recipes of [
    [plain, localized, duplicatePage],
    [duplicatePage, plain, localized],
    [localized, duplicatePage, plain],
  ]) {
    const [result] = expandSmallGroups(recipes, {})
    assert.equal(result.ingredients[1].name, "Cutting Tool")
    assert.equal(result.ingredients[1].slug, "cutting-tool")
    assert.equal(result.ingredients[1].namePl, "Narzędzie do krojenia")
  }
})

test("deduplication preserves distinct identities, effects, quantities, selectors and instructions", () => {
  const base = row(item("Potion"), [item("Water"), item("Herb")])
  const variants = [
    base,
    base.with({ result: base.result.with({ statsId: "Poison" }) }),
    base.with({ result: base.result.with({ effect: { en: "Poisoned" } }) }),
    base.with({ result: base.result.with({ quantity: "x2" }) }),
    base.with({ ingredients: [item("Water", { quantity: "x2" }), item("Herb")] }),
    base.with({ ingredients: [item("Water"), item("Herb", { statsId: "OtherHerb" })] }),
    base.with({ ingredients: [item("Water"), item("Herb", { selectorTag: "Herb" })] }),
    base.with({ ingredients: [item("Water"), item("Herb"), item("Herb")] }),
    base.with({ requirements: "Crafting 2" }),
    base.with({ transformsIngredient: 0, notes: "Heal" }),
    base.with({ transformsIngredient: 1, notes: "Heal" }),
  ]
  assert.equal(expandSmallGroups(variants, {}).length, variants.length)
})

test("a missing remark does not duplicate a recipe but conflicting instructions remain separate", () => {
  const base = row(item("Arrow"), [item("Arrowhead"), item("Arrow Shaft")]).with({ id: "base" })
  const annotated = base.with({
    id: "annotated",
    ingredients: [...base.ingredients].reverse(),
    remarks: "Serves No Function",
  })
  for (const recipes of [
    [base, annotated],
    [annotated, base],
  ]) {
    const result = expandSmallGroups(recipes, {})
    assert.equal(result.length, 1)
    assert.equal(result[0].remarks, annotated.remarks)
    assert.deepEqual(new Set(result[0].sourceRecipeIds), new Set(["base", "annotated"]))
    assert.deepEqual(expandSmallGroups(result, {}), result)
  }
  const conflicting = annotated.with({ id: "conflicting", remarks: "Use a furnace" })
  const result = expandSmallGroups([base, annotated, conflicting], {})
  assert.equal(result.length, 2)
  assert.deepEqual(
    result.map((row) => row.remarks),
    ["Serves No Function", "Use a furnace"],
  )
  assert.equal(base.remarks, "")
})

test("ingredient reordering preserves the identity of an ingredient modified in place", () => {
  const first = row(item("Sword"), [item("Sword"), item("Oil")]).with({
    transformsIngredient: 0,
    notes: "Fire damage",
  })
  const reversed = first.with({ ingredients: [...first.ingredients].reverse(), transformsIngredient: 1 })
  assert.equal(expandSmallGroups([first, reversed], {}).length, 1)
})

test("approved material categories keep the correct slot and material", () => {
  const match = matcher(item("Light Boots", { selectorTag: "BootsLeather" }))!
  assert.equal(match(item("Leather Boots")), true)
  assert.equal(match(item("Unique Shadow Armor Boots")), true)
  assert.equal(match(item("Warrior Boots", { craftingCategories: ["BootsScale", "ArmorShoes"] })), false)
  assert.equal(match(item("Leather Gloves")), false)
  assert.equal(match(item("Oddly named footwear", { craftingCategories: ["BootsLeather"] })), true)
  const torso = matcher(item("Finesse Based Armor", { selectorTag: "ArmorLeather" }))!
  assert.equal(torso(item("Unique Ranger Armor Upperbody")), true)
  assert.equal(torso(item("Unique Ranger Armor Lowerbody")), false)
  assert.equal(torso(item("Unique Warrior Armor Upperbody")), false)
})

test("category use does not convert a concrete result with the same name into a group", () => {
  const concrete = item("Axe", { craftingCategories: ["Axe", "Weapon"], slug: "axe" })
  const category = item("Axe", { selectorTag: "Axe" })
  const recipes = [row(concrete, [item("Metal")]), row(item("Improved Axe"), [category])]
  const groups = buildItemGroups(recipes, 1)
  assert.deepEqual(
    groups.axe.members.map((i) => i.name),
    ["Axe", "Improved Axe"],
  )
  const expanded = expandSmallGroups(recipes, groups)
  assert.equal(expanded.filter((r) => r.id === "Axe").length, 1)
  assert.equal(expanded.find((r) => r.id === "Axe")?.result.selectorTag, undefined)
  assert.equal(matcher(item("Mace", { selectorTag: "Club" }))!(item("Two Handed Mace")), false)
  assert.equal(matcher(item("Two Handed Mace", { selectorTag: "TwoHandedMaces" }))!(item("Crafted 2H Mace")), true)
  assert.equal(matcher(item("Axe", { selectorTag: "Axe" }))!(item("Axe Skillbook")), false)
})

test("small upgrade groups modify the selected ingredient instead of mixing different equipment", () => {
  for (const count of [1, 2, 3]) {
    const members = ["Leather Boots", "Ranger Boots", "Shadow Boots"]
      .slice(0, count)
      .map((name) => item(name, { slug: name }))
    const source = row(item("Boosted Boots", { selectorTag: "BootsLeather" }), [
      item("Altar"),
      item("Light Boots", { selectorTag: "BootsLeather" }),
      item("Rune"),
    ]).with({
      transformsIngredient: 1,
      notes: "Tactical Retreat",
    })
    const groups = {
      boostedboots: { id: "boostedboots", name: "Boosted Boots", members },
      lightboots: { id: "lightboots", name: "Light Boots", members },
    }
    const expanded = expandSmallGroups([source], groups)
    assert.equal(expanded.length, count)
    for (const recipe of expanded) {
      assert.equal(recipe.result.name, recipe.ingredients[1].name)
      assert.equal(recipe.result.slug, recipe.ingredients[1].slug)
      assert.equal(recipe.result.selectorTag, undefined)
      assert.equal(recipe.notes, "Tactical Retreat")
      assert.equal(recipe.transformsIngredient, 1)
    }
    assert.deepEqual(expandSmallGroups(expanded, groups), expanded)
  }
})

test("reusing an existing group preserves tools with no remaining individual recipe references", () => {
  const recipes = [row(item("Cold Fries"), [item("Potato"), item("Knife or Dagger")])]
  const tools = [
    item("Knife", { craftingCategories: ["Knife"], slug: "knife" }),
    item("Dagger", { craftingCategories: ["Dagger"], slug: "dagger" }),
  ]
  const groups = buildItemGroups(recipes, 1, tools)
  assert.deepEqual(
    groups.knifeordagger.members.map((i) => i.name),
    ["Dagger", "Knife"],
  )
  assert.equal(expandSmallGroups(recipes, groups).length, 2)
  assert.deepEqual(
    groups.knifeordagger.rows(recipes).map((r) => r.result.name),
    ["Dagger", "Knife"],
  )
  assert.deepEqual(buildItemGroups([row(item("Food"), [item("Potato")])], 1, tools), {})
})

test("game-defined groups take members by Stats ID, not by a shared name", () => {
  const gold = matcher(item("#Gold-Object", { selectorTag: "Gold-Object" }))!
  assert.equal(gold(item("Plate", { statsId: "ITEM_Rich_Plate_A" })), true)
  assert.equal(gold(item("Plate", { statsId: "ITEM_Ceramic_Plate_A" })), false)
  // Scenery that shares the gold glass's Stats entry cannot be carried to an anvil.
  assert.equal(gold(item("Source Fountain", { statsId: "ITEM_Rich_Glass_A" })), false)
  const water = matcher(item("#Water-Source", { selectorTag: "Water-Source" }))!
  assert.equal(water(item("Cup of Water", { statsId: "CON_Drink_Cup_A_Water" })), true)
  assert.equal(water(item("Cup of Water", { statsId: "CON_Drink_Cup_A_Oil" })), false)
  // Items without a game ID still match by the game's names.
  assert.equal(water(item("Cup of Water")), true)
})
