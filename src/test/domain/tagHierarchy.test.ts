import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { nestTagStats, groupRecipeTags, type TagFilterNode } from "../../main/domain/recipeView"
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
const find = (nodes: TagFilterNode[], tag: string): TagFilterNode | undefined =>
  nodes.map((node) => (node.tag === tag ? node : find(node.children ?? [], tag))).find(Boolean)
const ids = (rows: RecipeRow[], filters: Partial<ReturnType<typeof emptyFilters>>) =>
  filterRecipes(rows, { ...emptyFilters(), ...filters }, {}).map((r) => r.id)

test("items carry leaf tags; parents come from the hierarchy for counts and filters", () => {
  const rows = [row("bow", ["Bows"]), row("staff", ["Staves"]), row("boots", ["Boots"])]
  const stats = collectRecipeStats([...rows, { ...rows[0], id: "second-bow-recipe" }]).tags
  const weapons = find(nestTagStats(stats), "Weapons")!
  assert.equal(weapons.count, 2)
  assert.deepEqual(new Set(weapons.children?.map((node) => node.tag)), new Set(["Bows", "Staves"]))
  assert.deepEqual(ids(rows, { include: ["Weapons"] }), ["bow", "staff"])
  assert.deepEqual(ids(rows, { include: ["Bows"] }), ["bow"])
  assert.deepEqual(ids(rows, { exclude: ["Weapons"] }), ["boots"])
})

test("magical damage groups every magical subtype and counts multi-element items once", () => {
  const parent = "Magic-Damage"
  const elements = [
    "Fire-Damage",
    "Water-Damage",
    "Air-Damage",
    "Earth-Damage",
    "Poison-Damage",
    "Shadow-Damage",
    "Tenebrium-Damage",
  ]
  const rows = elements.map((element) => row(element, [element]))
  rows.push(row("mixed", ["Fire-Damage", "Water-Damage"]), row("physical", ["Physical-Damage"]))
  rows.push(row("piercing", ["Piercing-Damage"]))
  const stats = collectRecipeStats([...rows, { ...rows[7], id: "another mixed recipe" }]).tags
  const section = groupRecipeTags(stats, getCechySidebarGroups()).find((group) => group.label === "Obrażenia")!
  assert.deepEqual(
    section.tags.map((node) => node.tag),
    [parent, "Physical-Damage", "Piercing-Damage"],
  )
  assert.equal(section.tags[0].count, 8)
  assert.deepEqual(new Set(section.tags[0].children!.map((child) => child.tag)), new Set(elements))
  assert.equal(ids(rows, { include: [parent] }).length, 8)
  assert.deepEqual(ids(rows, { exclude: [parent] }), ["physical", "piercing"])
  assert.deepEqual(ids(rows, { include: ["Fire-Damage"] }), ["Fire-Damage", "mixed"])
})

test("combat abilities form weapon, defence and skill-school groups with independent parent filters", () => {
  const groups = ["Weapon-Abilities", "Defence-Abilities", "Skill-Schools"]
  const rows = [
    row("sword", ["Single-Handed"]),
    row("leader", ["Leadership"]),
    row("mage", ["Aerotheurge", "Geomancer"]),
    row("civil", ["Bartering"]),
  ]
  const sections = groupRecipeTags(collectRecipeStats(rows).tags, getCechySidebarGroups())
  const combat = sections.find((section) => section.label === "Biegłości bojowe")!
  assert.deepEqual(
    combat.tags.map((tag) => [tag.tag, tag.count]),
    groups.map((group) => [group, 1]),
  )
  assert.equal(combat.tags[2].children!.length, 2)
  for (const [index, group] of groups.entries()) {
    assert.deepEqual(ids(rows, { include: [group] }), [rows[index].id])
    assert.equal(ids(rows, { exclude: [group] }).length, 3)
  }
})

test("every active product tag has a filter except structural and game markers", () => {
  const hidden = new Set(["Category", "DOS1", "DOS2", "DOS2-CO"])
  const flatten = (nodes: TagFilterNode[]): string[] => nodes.flatMap((n) => [n.tag, ...flatten(n.children ?? [])])
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
})

test("weapon ability filters describe granted bonuses rather than weapon handedness", () => {
  const audit = JSON.parse(fs.readFileSync("reports/item-effects-audit.json", "utf8"))
  const fields = {
    Jednoręczna: "SingleHanded",
    Dwuręczna: "TwoHanded",
    "Dual-Wielding": "DualWielding",
    Dystansowa: "Ranged",
  }
  for (const catalog of Object.values(audit.catalogs) as Array<{
    items: Array<{ identities: Array<{ stats: string; effect_tags?: string[]; fields: Record<string, string> }> }>
  }>)
    for (const item of catalog.items)
      for (const identity of item.identities)
        for (const [tag, field] of Object.entries(fields))
          if ((identity.effect_tags ?? []).includes(tag))
            assert.ok(Number(identity.fields[field]) > 0, `${identity.stats}: ${field}`)
})

test("sidebar tags are ordered by entry count at every level", () => {
  const rows = [
    row("bow", ["Bows"]),
    row("staff-1", ["Staves"]),
    row("staff-2", ["Staves"]),
    row("staff-3", ["Staves"]),
    row("boots", ["Boots"]),
  ]
  const tree = nestTagStats(collectRecipeStats(rows).tags)
  const weapons = find(tree, "Weapons")!
  assert.deepEqual(
    weapons.children?.map((node) => node.tag),
    ["Staves", "Bows"],
  )
  const counts = (nodes: TagFilterNode[]): void => {
    for (const [index, node] of nodes.entries()) {
      if (index > 0) assert.ok(nodes[index - 1].count >= node.count, node.tag)
      counts(node.children ?? [])
    }
  }
  counts(tree)
  for (const group of groupRecipeTags(collectRecipeStats(rows).tags, getCechySidebarGroups())) counts(group.tags)
})
