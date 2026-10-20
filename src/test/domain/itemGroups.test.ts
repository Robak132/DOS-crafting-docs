import assert from "node:assert/strict"
import { test } from "node:test"
import { buildItemGroups, expandSmallGroups, groupItemRows, groupMatcher } from "../../main/domain/itemGroups"
import type { RecipeItem, RecipeRow } from "../../main/domain/recipes"

const item = (name: string, extra: Partial<RecipeItem> = {}): RecipeItem => ({ name, tags: [], ...extra })
const row = (result: RecipeItem, ingredients: RecipeItem[] = []): RecipeRow => ({
  id: result.name,
  result,
  ingredients,
  tags: [],
  notes: "",
  remarks: "",
  source: "",
  requirements: "",
})

test("selector groups require four distinct members and include ingredients without icons or recipes", () => {
  const definition = item("#Fish", { selectorTag: "Fish" })
  const members = ["Salmon", "Herring", "Trout", "Mackerel"].map((name) => item(name))
  const recipes = [row(item("Dinner"), [definition, ...members.slice(0, 3)])]
  assert.deepEqual(buildItemGroups(recipes), {})
  recipes.push(row(members[0], [members[3], members[0]]))
  const groups = buildItemGroups(recipes)
  assert.equal(groups.fish.members.length, 4)
  const results = groupItemRows(recipes, groups.fish)
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
  const match = groupMatcher(item("#Air-Skillbook", { selectorTag: "Air-Skillbook" }))!
  assert.equal(match(item("Teleportation Skillbook", { craftingCategories: ["AirSkillbook"] })), true)
  assert.equal(match(item("Fireball Skillbook", { craftingCategories: ["FireSkillbook"] })), false)
  assert.equal(groupMatcher(item("Knife or Dagger"))!(item("Searing Daggers Scroll")), false)
  assert.equal(groupMatcher(item("Wood Chips, Nails"))!(item("Wood Chips and Arrow Shaft")), false)
  assert.equal(
    groupMatcher(
      item("#Small-Or-Medium-Or-Large-Or-Giant-Rune", { selectorTag: "Small-Or-Medium-Or-Large-Or-Giant-Rune" }),
    )!(item("Giant % Rune")),
    false,
  )
  assert.equal(groupMatcher(item("ADD AIR, FIRE, WATER")), undefined)
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
    assert.deepEqual(input.members.map((member) => member.name).sort(), [...names].sort())
    assert.deepEqual(output.members, input.members)
    assert.equal(groupItemRows(recipes, output).length, 4)
  }
  const helmet = groupMatcher(item("Helmet", { selectorTag: "Helmet" }))!
  assert.equal(helmet(item("Unnamed headgear", { craftingCategories: ["Helmet"] })), true)
  assert.equal(helmet(item("Helmet-shaped Boots", { craftingCategories: ["ArmorShoes"] })), false)
})

test("groups of one, two and three members become concrete recipe variants, preserving quantities and metadata", () => {
  for (const count of [1, 2, 3]) {
    const members = ["Salmon", "Trout", "Herring"]
      .slice(0, count)
      .map((name) => item(name, { slug: name, icon: `${name}.webp` }))
    const source = {
      ...row(item("Dinner"), [item("#Fish", { selectorTag: "Fish", quantity: "x2" }), item("Salt")]),
      notes: "Effect",
      remarks: "At oven",
      source: "Game",
      requirements: "Crafting 2",
    }
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
  const original = { ...row(item("Dinner"), [item("#Fish", { selectorTag: "Fish" })]), source: "Group source" }
  const concrete = { ...row(item("Dinner"), [item("Salmon")]), id: "concrete", source: "Concrete source" }
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

test("approved material categories keep the correct slot and material", () => {
  const match = groupMatcher(item("Light Boots", { selectorTag: "BootsLeather" }))!
  assert.equal(match(item("Leather Boots")), true)
  assert.equal(match(item("Unique Shadow Armor Boots")), true)
  assert.equal(match(item("Warrior Boots", { craftingCategories: ["BootsScale", "ArmorShoes"] })), false)
  assert.equal(match(item("Leather Gloves")), false)
  assert.equal(match(item("Oddly named footwear", { craftingCategories: ["BootsLeather"] })), true)
  const torso = groupMatcher(item("Finesse Based Armor", { selectorTag: "ArmorLeather" }))!
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
  assert.equal(groupMatcher(item("Mace", { selectorTag: "Club" }))!(item("Two Handed Mace")), false)
  assert.equal(groupMatcher(item("Two Handed Mace", { selectorTag: "TwoHandedMaces" }))!(item("Crafted 2H Mace")), true)
  assert.equal(groupMatcher(item("Axe", { selectorTag: "Axe" }))!(item("Axe Skillbook")), false)
})

test("small upgrade groups modify the selected ingredient instead of mixing different equipment", () => {
  for (const count of [1, 2, 3]) {
    const members = ["Leather Boots", "Ranger Boots", "Shadow Boots"]
      .slice(0, count)
      .map((name) => item(name, { slug: name }))
    const source = {
      ...row(item("Boosted Boots", { selectorTag: "BootsLeather" }), [
        item("Altar"),
        item("Light Boots", { selectorTag: "BootsLeather" }),
        item("Rune"),
      ]),
      transformsIngredient: 1,
      notes: "Tactical Retreat",
    }
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
    groupItemRows(recipes, groups.knifeordagger).map((r) => r.result.name),
    ["Dagger", "Knife"],
  )
  assert.deepEqual(buildItemGroups([row(item("Food"), [item("Potato")])], 1, tools), {})
})
