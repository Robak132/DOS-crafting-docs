import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { nestTagStats, groupRecipeTags } from "../../main/domain/recipeView"
import { collectRecipeStats, getCechySidebarGroups, type RecipeRow } from "../../main/domain/recipes"
import { emptyFilters, filterRecipes } from "../../main/filters"

const row = (id: string, tags: string[]): RecipeRow => ({
  id,
  result: { name: id, tags },
  ingredients: [],
  tags,
  notes: "",
  remarks: "",
  requirements: "",
  source: "",
})

test("equipment tag parents contain their subtypes and count each item once", () => {
  const rows = [
    row("bow", ["Typ/Bron", "Typ/Bron/Luki"]),
    row("staff", ["Typ/Bron", "Typ/Bron/Kostury"]),
    row("boots", ["Typ/Pancerz", "Typ/Pancerz/Buty"]),
  ]
  const stats = collectRecipeStats([...rows, { ...rows[0], id: "second-bow-recipe" }]).tags
  const tree = nestTagStats(stats)
  const weapons = tree.find((node) => node.tag === "Typ/Bron")!
  assert.equal(weapons.count, 2)
  assert.deepEqual(new Set(weapons.children?.map((node) => node.tag)), new Set(["Typ/Bron/Luki", "Typ/Bron/Kostury"]))
  assert.equal(filterRecipes(rows, { ...emptyFilters(), include: ["Typ/Bron"] }, {}).length, 2)
  assert.deepEqual(
    filterRecipes(rows, { ...emptyFilters(), include: ["Typ/Bron/Luki"] }, {}).map((r) => r.id),
    ["bow"],
  )
  assert.deepEqual(
    filterRecipes(rows, { ...emptyFilters(), exclude: ["Typ/Bron"] }, {}).map((r) => r.id),
    ["boots"],
  )
})

test("saved item tags reflect effects while keeping independent categories", () => {
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8")) as {
    recipes: RecipeRow[]
  }
  const refs = source.recipes.flatMap((r) => [r.result, ...r.ingredients])
  for (const [name, tags] of [
    [
      "Winter Staff",
      [
        "Typ/Bron",
        "Typ/Bron/Kostury",
        "Typ/Przedmioty-wydarzen",
        "Cechy/Umiejetnosci/Hydrosophia",
        "Cechy/Odporność-na-wodę",
        "Efekty/Statusy/WET",
      ],
    ],
    ["Wand of Source", ["Typ/Bron/Rozdzki", "Cechy/Pamięć", "Cechy/Zręczność", "Efekty/Powierzchnie/Source"]],
    ["Jellyroom", ["Typ/Skladniki", "Cechy/Odporność-na-powietrze"]],
    ["Air Bow", ["Typ/Bron/Luki", "Typ/Magia", "Cechy/Obrażenia-magiczne/powietrza"]],
  ] as const) {
    const matches = refs.filter((item) => item.name === name && !item.selectorTag)
    assert.ok(matches.length, name)
    for (const item of matches) for (const tag of tags) assert.ok(item.tags.includes(tag), `${name}: ${tag}`)
  }
  const blank = refs.find((item) => item.name === "Blank Air Skillbook")!
  assert.ok(!blank.tags.some((tag) => tag.startsWith("Cechy/Immunitet")), "object immunities are not player buffs")
  for (const recipe of source.recipes) assert.deepEqual(recipe.tags, recipe.result.tags)
})

test("magical damage groups every magical subtype and counts multi-element items once", () => {
  const parent = "Cechy/Obrażenia-magiczne"
  const suffixes = ["ognia", "wody", "powietrza", "ziemi", "trucizny", "cienia", "tenebrium"]
  const rows = suffixes.map((suffix) => row(suffix, [parent, `${parent}/${suffix}`]))
  rows.push(row("mixed", [parent, `${parent}/ognia`, `${parent}/wody`]))
  rows.push(row("physical", ["Cechy/Obrażenia-fizyczne"]))
  rows.push(row("piercing", ["Cechy/Obrażenia-przeszywające"]))
  const stats = collectRecipeStats([...rows, { ...rows[7], id: "another mixed recipe" }]).tags
  const magic = nestTagStats(stats).find((node) => node.tag === parent)!
  const section = groupRecipeTags(stats, getCechySidebarGroups()).find((group) => group.label === "Obrażenia")!
  assert.deepEqual(
    section.tags.map((node) => node.tag),
    [parent, "Cechy/Obrażenia-fizyczne", "Cechy/Obrażenia-przeszywające"],
  )
  assert.equal(section.tags[0].children!.length, 7)
  assert.equal(magic.count, 8)
  assert.deepEqual(new Set(magic.children!.map((child) => child.tag)), new Set(suffixes.map((s) => `${parent}/${s}`)))
  assert.equal(filterRecipes(rows, { ...emptyFilters(), include: [parent] }, {}).length, 8)
  assert.deepEqual(
    filterRecipes(rows, { ...emptyFilters(), exclude: [parent] }, {}).map((r) => r.id),
    ["physical", "piercing"],
  )
  assert.deepEqual(
    filterRecipes(rows, { ...emptyFilters(), include: [`${parent}/ognia`] }, {}).map((r) => r.id),
    ["ognia", "mixed"],
  )
})

test("combat abilities form weapon, defence and skill-school groups with independent parent filters", () => {
  const groups = ["Cechy/Bieglosci-broni", "Cechy/Bieglosci-obrony", "Cechy/Umiejetnosci"]
  const rows = [
    row("sword", [groups[0], `${groups[0]}/Jednoręczna`]),
    row("leader", [groups[1], `${groups[1]}/Przywództwo`]),
    row("mage", [groups[2], `${groups[2]}/Aeroteurgia`, `${groups[2]}/Geomancja`]),
    row("civil", ["Cechy/Handel"]),
  ]
  const sections = groupRecipeTags(collectRecipeStats(rows).tags, getCechySidebarGroups())
  const combat = sections.find((section) => section.label === "Biegłości bojowe")!
  assert.deepEqual(
    combat.tags.map((tag) => tag.tag),
    groups,
  )
  assert.deepEqual(
    combat.tags.map((tag) => tag.count),
    [1, 1, 1],
  )
  assert.equal(combat.tags[2].children!.length, 2)
  for (const [index, group] of groups.entries()) {
    assert.deepEqual(
      filterRecipes(rows, { ...emptyFilters(), include: [group] }, {}).map((r) => r.id),
      [rows[index].id],
    )
    assert.equal(filterRecipes(rows, { ...emptyFilters(), exclude: [group] }, {}).length, 3)
  }
  assert.ok(!sections.some((section) => ["Bronie", "Obrona", "Szkoły umiejętności"].includes(section.label)))
  const hierarchy = getCechySidebarGroups().find((group) => group.label === "Biegłości bojowe")!
  for (const leaf of ["Wytrwałość", "Odbicie", "Krzepa", "Siła-woli"])
    assert.ok(hierarchy.childTags.includes(`${groups[1]}/${leaf}`))
  assert.ok(hierarchy.childTags.includes(`${groups[2]}/Łowiectwo`))
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    const source = JSON.parse(fs.readFileSync(`data/library/recipes/${game}.json`, "utf8"))
    for (const recipe of source.recipes)
      for (const item of [recipe.result, ...recipe.ingredients])
        for (const group of groups)
          if (item.tags.some((tag: string) => tag.startsWith(group + "/")))
            assert.ok(item.tags.includes(group), item.name)
  }
})

test("every active product tag has a filter except structural and game markers", () => {
  const hidden = new Set(["Typ", "Cechy", "DOS1", "DOS2", "DOS2-CO"])
  const flatten = (nodes: ReturnType<typeof nestTagStats>): string[] =>
    nodes.flatMap((n) => [n.tag, ...flatten(n.children ?? [])])
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    const recipes = JSON.parse(fs.readFileSync(`data/library/recipes/${game}.json`, "utf8")).recipes
    const stats = collectRecipeStats(recipes).tags
    const visible = new Set(groupRecipeTags(stats, getCechySidebarGroups()).flatMap((g) => flatten(g.tags)))
    assert.deepEqual(
      stats.filter(({ tag }) => !hidden.has(tag) && !visible.has(tag)),
      [],
      game,
    )
  }
  const shadow = groupRecipeTags(
    collectRecipeStats([row("shadow", ["Cechy/Odporność-na-cień"])]).tags,
    getCechySidebarGroups(),
  )
  assert.equal(shadow.find((group) => group.label === "Odporności")?.tags[0].tag, "Cechy/Odporność-na-cień")
  const unknown = { tag: "Cechy/NewTrait", count: 1, label: "New trait" }
  const fallback = groupRecipeTags([unknown], getCechySidebarGroups())
  assert.equal(fallback.find((group) => group.label === "Inne")?.tags[0].tag, unknown.tag)
})

test("weapon ability filters describe granted bonuses rather than weapon handedness", () => {
  const prefix = "Cechy/Bieglosci-broni"
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8")).recipes as RecipeRow[]
  for (const statsId of ["WPN_Bow", "WPN_Sword_2H", "WPN_Spooky_Broom_Staff"])
    for (const recipe of source.filter((r) => r.result.statsId === statsId))
      assert.ok(!recipe.result.tags.some((tag) => tag.startsWith(prefix)), statsId)
  const strengthUpgrade = source.find((r) => r.result.name === "Boosted Two Handed Axe (+1) Strength")!
  assert.ok(!strengthUpgrade.result.tags.some((tag) => tag.startsWith(prefix)))
  const abilityUpgrade = source.find((r) => r.result.name === "Boosted Two Handed Axe (+1) Two Handed")!
  assert.ok(abilityUpgrade.result.tags.includes(`${prefix}/Dwuręczna`))
  const audit = JSON.parse(fs.readFileSync("reports/item-effects-audit.json", "utf8"))
  const fields = {
    Jednoręczna: "SingleHanded",
    Dwuręczna: "TwoHanded",
    "Walka-dwoma-broniami": "DualWielding",
    Dystansowa: "Ranged",
  }
  for (const catalog of Object.values(audit.catalogs) as Array<{
    items: Array<{ identities: Array<{ stats: string; effect_tags: string[]; fields: Record<string, string> }> }>
  }>)
    for (const item of catalog.items)
      for (const identity of item.identities)
        for (const [suffix, field] of Object.entries(fields))
          if (identity.effect_tags.includes(`${prefix}/${suffix}`))
            assert.ok(Number(identity.fields[field]) > 0, `${identity.stats}: ${field}`)
})

test("armour tags classify the base profile at 75 percent without removing real armour effects", () => {
  const source = JSON.parse(fs.readFileSync("data/library/recipes/dos2-overhaul.json", "utf8")).recipes as RecipeRow[]
  const find = (name: string) => source.find((row) => row.result.name === name)!.result
  const physical = "Cechy/Pancerz-fizyczny"
  const magical = "Cechy/Pancerz-magiczny"
  const balanced = "Cechy/Pancerz-zbalansowany"
  const tiara = find("Empress Tiara")
  assert.ok(tiara.tags.includes(magical))
  assert.ok(!tiara.tags.includes(physical))
  assert.ok(!tiara.tags.includes(balanced))
  const gloves = find("Crocodile Gloves")
  assert.ok(gloves.tags.includes(physical))
  assert.ok(!gloves.tags.includes(magical))
  const boots = find("Bone Boots")
  assert.ok(boots.tags.includes(balanced))
  assert.ok(boots.tags.includes(physical))
  assert.ok(boots.tags.includes(magical))
  assert.ok(find("Buck Boots").tags.includes(balanced))
  const effects = JSON.parse(fs.readFileSync("data/itemEffects.json", "utf8"))["dos2-overhaul"]
  assert.ok(effects.empresstiara.en.includes("Physical armour"))
  assert.ok(effects.empresstiara.en.includes("Magic armour"))
})
