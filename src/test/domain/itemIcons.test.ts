import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import { IconAtlas, type ItemIconMap } from "../../main/domain/iconAtlas"
import { Item, type ItemData } from "../../main/domain/item"

const icons: ItemIconMap = JSON.parse(fs.readFileSync("data/itemIcons.json", "utf8"))
const resolveItemIcon = (map: ItemIconMap, game: "dos1" | "dos2" | "dos2-overhaul", item: ItemData) =>
  new IconAtlas(map, game).iconOf(new Item(item))

test("inventory icons stay scoped to the game and ignore ingredient selectors", () => {
  const item = { name: "Minor Healing Potion", statsId: "POTION_Minor_Healing_Potion", tags: [] }
  assert.ok(resolveItemIcon(icons, "dos1", item))
  assert.ok(resolveItemIcon(icons, "dos2", item))
  assert.notEqual(resolveItemIcon(icons, "dos1", item), resolveItemIcon(icons, "dos2", item))
  assert.equal(resolveItemIcon(icons, "dos2", { ...item, selectorTag: "Minor Healing Potion" }), undefined)
  assert.equal(resolveItemIcon(icons, "dos2", { name: "Unknown item", tags: [] }), undefined)
  assert.equal(
    resolveItemIcon(icons, "dos2", { ...item, name: "MINOR HEALING POTION" }),
    resolveItemIcon(icons, "dos2", item),
  )
})

test("an item is linked to its data by game identity, not by its shared name", () => {
  const gold = { name: "Plate", statsId: "ITEM_Rich_Plate_A", tags: [] }
  const ceramic = { name: "Plate", statsId: "ITEM_Ceramic_Plate_A", tags: [] }
  assert.ok(resolveItemIcon(icons, "dos2-overhaul", gold))
  assert.notEqual(resolveItemIcon(icons, "dos2-overhaul", gold), resolveItemIcon(icons, "dos2-overhaul", ceramic))
  // Several pages on one generic Stats entry keep their own names as data keys.
  const items = [
    { name: "Pickaxe", slug: "pickaxe", statsId: "WPN_Axe_2H", tags: [] },
    { name: "Crafted 2H Axe", slug: "crafted-2h-axe", statsId: "WPN_Axe_2H", tags: [] },
    { name: "Gold Cup", slug: "gold-cup", statsId: "ITEM_EmptyCupGold", tags: [] },
  ].map(Item.from)
  Item.assignDataKeys(items)
  assert.deepEqual(
    items.map((entry) => entry.resourceKey),
    ["pickaxe", "crafted2haxe", "itememptycupgold"],
  )
  assert.equal(items[0].effectKey, "wpnaxe2h")
})

test("DOS2 exports only use Definitive Edition atlases and Overhaul also includes mod atlases", () => {
  const sources = JSON.parse(fs.readFileSync("data/itemIcons.provenance.json", "utf8"))
  assert.ok(Object.values<{ atlas: string }>(sources.dos2).every((source) => source.atlas.startsWith("dos2/")))
  assert.ok(
    Object.values<{ atlas: string }>(sources["dos2-overhaul"]).some((source) => source.atlas.startsWith("overhaul/")),
  )
  for (const names of Object.values(icons)) {
    for (const icon of Object.values(names)) {
      const image = fs.readFileSync(icon.replace("data/icons/", "assets/item-icons/"))
      assert.equal(image.toString("ascii", 0, 4), "RIFF")
      assert.equal(image.toString("ascii", 8, 12), "WEBP")
    }
  }
})
