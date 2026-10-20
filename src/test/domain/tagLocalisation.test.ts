import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"

test("tag labels use game-localized terminology and preserve game boundaries", () => {
  const data = JSON.parse(fs.readFileSync("data/tagLocalisation.json", "utf8"))
  for (const [tag, label] of Object.entries({
    "Cechy/Znawca": "Polihistor",
    "Cechy/Szczęście": "Fart",
    "Cechy/Umiejetnosci/Wojna": "Sztuka walki",
    "Cechy/Umiejetnosci/Łowiectwo": "Myślistwo",
    "Cechy/Umiejetnosci/Łobuz": "Szelmostwo",
    "Cechy/Umiejetnosci/Pyrokinetyka": "Pirokineza",
    "Typ/Pancerz/Spodnie": "Nogawice",
    "Typ/Pancerz/Napiersniki": "Klatka piersiowa",
    "Typ/Bron/Bulawy": "Buławy",
    "Typ/Bron/Sztylety": "Sztylety",
  })) {
    assert.equal(data.dos2[tag].pl, label, tag)
    assert.equal(data["dos2-overhaul"][tag].pl, label, tag)
  }
  assert.equal(data.dos1["Cechy/Szybkość"].pl, "Prędkość")
  assert.equal(data.dos1["Cechy/Zwinność"].pl, "Zwinność")
  assert.equal(data.dos2["Cechy/Zręczność"].pl, "Zręczność")
  assert.ok(!data.dos1["Cechy/Znawca"].pl, "no invented DOS1 translation")
})

test("effect notes use the active game's official vocabulary", async () => {
  const { formatEffectNote } = await import("../../main/domain/recipeView")
  assert.equal(
    formatEffectNote("+1 Loremaster; +1 Lucky Charm; +1 Finesse", {
      loremaster: "Polihistor",
      "lucky charm": "Fart",
      finesse: "Zręczność",
    }),
    "+1 Polihistor; +1 Fart; +1 Zręczność",
  )
  assert.equal(formatEffectNote("+1 Speed", { speed: "Prędkość" }), "+1 Prędkość")
})
