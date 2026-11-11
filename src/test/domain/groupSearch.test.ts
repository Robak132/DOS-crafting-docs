import assert from "node:assert/strict"
import { test } from "node:test"
import { GroupQuery, GroupSearch } from "../../main/domain/groupSearch"
import { Item, type ItemData } from "../../main/domain/item"
import { ItemGroup, type ItemGroups } from "../../main/domain/itemGroup"
import { Recipe } from "../../main/domain/recipe"

const item = (name: string, extra: Partial<ItemData> = {}) => new Item({ name, tags: [], ...extra })
const row = (id: string, result: Item, ingredients: Item[] = []) =>
  new Recipe({ id, result, ingredients, tags: [], notes: "", remarks: "", source: "", requirements: "" })
const bones = item("#Bones", { selectorTag: "Bones", groupId: "bones", groupSize: 2, namePl: "#Kości" })
const groups: ItemGroups = {
  bones: new ItemGroup({ id: "bones", name: "#Bones", members: [item("Skull"), item("Bone")] }),
}
const recipes = [
  row("skull", item("Skull"), [item("Corpse")]),
  row("bonedust", item("Bonedust"), [bones, item("Mortar")]),
  row("other", item("Torch"), [item("Stick")]),
]
const search = new GroupSearch(groups, recipes)

test('group tokens are #Name or #"Name with spaces"', () => {
  const query = new GroupQuery('#Bones dust #"Gold Object"')
  assert.deepEqual([query.groups, query.text], [["Bones", "Gold Object"], "dust"])
})

test("a group answers to its English and Polish names without regard to case or spacing", () => {
  for (const name of ["Bones", "bones", "Kości", "kosci"]) assert.equal(search.resolve(name), "bones")
  assert.equal(search.resolve("Fish"), undefined)
})

test("group search lists the members as products and the recipes that take the group as an ingredient", () => {
  const ids = (query: string, scope: "result" | "ingredient" | "all") =>
    search.apply(query, scope).rows.map((r) => r.id)
  assert.deepEqual(ids("#Bones", "ingredient"), ["bonedust"])
  assert.deepEqual(ids('#"Kości"', "result"), ["skull", "group:bones:bone"])
  assert.deepEqual(new Set(ids("#bones", "all")), new Set(["skull", "group:bones:bone", "bonedust"]))
  // Unknown names stay ordinary search text.
  assert.deepEqual(search.apply("#Fish torch", "all"), { rows: recipes, query: "#Fish torch" })
})

test("clicking a group opens the search for it", () => {
  assert.equal(GroupQuery.token(bones), "#Bones")
  assert.equal(GroupQuery.token({ name: "#Gold-Object", groupId: "goldobject" }), '#"Gold Object"')
  // A group whose name another group already has is opened by its id.
  assert.equal(GroupQuery.token({ name: "Warrior Boots", groupId: "warriorboots-1" }), "#warriorboots-1")
  const shared = new GroupSearch(
    {
      warriorboots: new ItemGroup({ id: "warriorboots", name: "Warrior Boots", members: [] }),
      "warriorboots-1": new ItemGroup({ id: "warriorboots-1", name: "Warrior Boots", members: [] }),
    },
    [],
  )
  assert.equal(shared.resolve("warriorboots-1"), "warriorboots-1")
  assert.equal(shared.resolve("Warrior Boots"), "warriorboots")
})
