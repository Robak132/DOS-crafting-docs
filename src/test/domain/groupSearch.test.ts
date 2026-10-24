import assert from "node:assert/strict"
import { test } from "node:test"
import { applyGroupQuery, groupSearchToken, parseGroupQuery, resolveGroup } from "../../main/domain/groupSearch"
import type { ItemGroups } from "../../main/domain/itemGroups"
import type { RecipeItem, RecipeRow } from "../../main/domain/recipes"

const item = (name: string, extra: Partial<RecipeItem> = {}): RecipeItem => ({ name, tags: [], ...extra })
const row = (id: string, result: RecipeItem, ingredients: RecipeItem[] = []): RecipeRow => ({
  id,
  result,
  ingredients,
  tags: [],
  notes: "",
  remarks: "",
  source: "",
  requirements: "",
})
const bones = item("#Bones", { selectorTag: "Bones", groupId: "bones", groupSize: 2, namePl: "#Kości" })
const groups: ItemGroups = { bones: { id: "bones", name: "#Bones", members: [item("Skull"), item("Bone")] } }
const recipes = [
  row("skull", item("Skull"), [item("Corpse")]),
  row("bonedust", item("Bonedust"), [bones, item("Mortar")]),
  row("other", item("Torch"), [item("Stick")]),
]

test('group tokens are #Name or #"Name with spaces"', () => {
  assert.deepEqual(parseGroupQuery('#Bones dust #"Gold Object"'), { groups: ["Bones", "Gold Object"], text: "dust" })
})

test("a group answers to its English and Polish names without regard to case or spacing", () => {
  for (const name of ["Bones", "bones", "Kości", "kosci"]) assert.equal(resolveGroup(name, groups, recipes), "bones")
  assert.equal(resolveGroup("Fish", groups, recipes), undefined)
})

test("group search lists the members as products and the recipes that take the group as an ingredient", () => {
  const ids = (query: string, scope: "result" | "ingredient" | "all") =>
    applyGroupQuery(recipes, groups, query, scope).rows.map((r) => r.id)
  assert.deepEqual(ids("#Bones", "ingredient"), ["bonedust"])
  assert.deepEqual(ids('#"Kości"', "result"), ["skull", "group:bones:bone"])
  assert.deepEqual(new Set(ids("#bones", "all")), new Set(["skull", "group:bones:bone", "bonedust"]))
  // Unknown names stay ordinary search text.
  assert.deepEqual(applyGroupQuery(recipes, groups, "#Fish torch", "all"), { rows: recipes, query: "#Fish torch" })
})

test("clicking a group opens the search for it", () => {
  assert.equal(groupSearchToken(bones), "#Bones")
  assert.equal(groupSearchToken({ name: "#Gold-Object", groupId: "goldobject" }), '#"Gold Object"')
  // A group whose name another group already has is opened by its id.
  assert.equal(groupSearchToken({ name: "Warrior Boots", groupId: "warriorboots-1" }), "#warriorboots-1")
  const shared: ItemGroups = {
    warriorboots: { id: "warriorboots", name: "Warrior Boots", members: [] },
    "warriorboots-1": { id: "warriorboots-1", name: "Warrior Boots", members: [] },
  }
  assert.equal(resolveGroup("warriorboots-1", shared, []), "warriorboots-1")
  assert.equal(resolveGroup("Warrior Boots", shared, []), "warriorboots")
})
