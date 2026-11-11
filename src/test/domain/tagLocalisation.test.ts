import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"

test("tag labels use game-localized terminology and preserve game boundaries", () => {
  const data = JSON.parse(fs.readFileSync("data/tagLocalisation.json", "utf8"))
  for (const [tag, label] of Object.entries({
    Loremaster: "Polihistor",
    "Lucky-Charm": "Fart",
    Warfare: "Sztuka walki",
    Huntsman: "Myślistwo",
    Scoundrel: "Szelmostwo",
    Pyrokinetic: "Pirokineza",
    Leggings: "Nogawice",
    "Chest-Armour": "Napierśnik",
    Maces: "Buławy",
    Daggers: "Sztylety",
  })) {
    assert.equal(data.dos2[tag].pl, label, tag)
    assert.equal(data["dos2-overhaul"][tag].pl, label, tag)
  }
  assert.equal(data.dos1["Speed"].pl, "Prędkość")
  assert.equal(data.dos1["Dexterity"].pl, "Zwinność")
  assert.equal(data.dos2["Finesse"].pl, "Zręczność")
  assert.ok(!data.dos1["Loremaster"].pl, "no invented DOS1 translation")
})

test("effect notes use the active game's official vocabulary", async () => {
  const { EffectNote } = await import("../../main/domain/effectNote")
  assert.equal(
    new EffectNote("+1 Loremaster; +1 Lucky Charm; +1 Finesse", {
      loremaster: "Polihistor",
      "lucky charm": "Fart",
      finesse: "Zręczność",
    }).polish(),
    "+1 Polihistor; +1 Fart; +1 Zręczność",
  )
  assert.equal(new EffectNote("+1 Speed", { speed: "Prędkość" }).polish(), "+1 Prędkość")
})
