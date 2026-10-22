import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import { resolveItemIcon, type ItemIconMap } from "../../main/domain/itemIcons"

const icons: ItemIconMap = JSON.parse(fs.readFileSync("data/itemIcons.json", "utf8"))

test("inventory icons stay scoped to the game and ignore ingredient selectors", () => {
  const item = { name: "Minor Healing Potion", tags: [] }
  assert.ok(resolveItemIcon(icons, "dos1", item))
  assert.ok(resolveItemIcon(icons, "dos2", item))
  assert.notEqual(resolveItemIcon(icons, "dos1", item), resolveItemIcon(icons, "dos2", item))
  assert.equal(resolveItemIcon(icons, "dos2", { ...item, selectorTag: "Minor Healing Potion" }), undefined)
  assert.equal(resolveItemIcon(icons, "dos2", { name: "Unknown item", tags: [] }), undefined)
  assert.equal(
    resolveItemIcon(icons, "dos2", { name: "MINOR HEALING POTION", tags: [] }),
    resolveItemIcon(icons, "dos2", item),
  )
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
