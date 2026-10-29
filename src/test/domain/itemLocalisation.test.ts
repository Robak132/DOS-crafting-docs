import assert from "node:assert/strict"
import { test } from "node:test"
import fs from "node:fs"
import { polishName } from "../../main/domain/itemLocalisation"
import { localizeItemForCatalog } from "../../main/domain/recipes"

test("DOS2 and Overhaul use the Definitive Edition dictionary", () => {
  for (const catalog of ["dos2", "dos2-overhaul"] as const) {
    assert.equal(polishName("Accuracy", catalog), "Celność")
    assert.equal(polishName("Wits", catalog), "Bystrość")
    assert.equal(polishName("Poison Potion", catalog), "Trucizna")
    assert.equal(polishName("Spirit", catalog), "Duch")
    assert.equal(polishName("Bairdotr's Armor", catalog), undefined)
  }
  assert.ok(polishName("Bairdotr's Armor", "dos1"))
  assert.equal(polishName("Spirit", "dos1"), "Spirytus")
})

test("official DOS2 names override old per-page translations", () => {
  assert.equal(localizeItemForCatalog({ name: "Spirit", namePl: "Spirytus", tags: [] }, "dos2").namePl, "Duch")
  assert.equal(
    localizeItemForCatalog({ name: "MOD ITEM", namePl: "Unverified", tags: [] }, "dos2-overhaul").namePl,
    undefined,
  )
  assert.equal(localizeItemForCatalog({ name: "Spirit", namePl: "Spirytus", tags: [] }, "dos1").namePl, "Spirytus")
})

test("Necromancer distinguishes the character from the ingredient selector", () => {
  assert.equal(polishName("Necromancer", "dos2"), "Nekromanta")
  const item = localizeItemForCatalog({ name: "#Necromancer", selectorTag: "Necromancer", tags: [] }, "dos2")
  assert.equal(item.namePl, "#Nekromancja")
})

test("recipe item names are English; Polish appears only as a translation", () => {
  const words = (value: string) => value.toLowerCase().match(/[a-ząćęłńóśźż]+/g) ?? []
  const english = new Set<string>()
  const polish = new Set<string>()
  const add = (entries: Record<string, string>) => {
    for (const [en, pl] of Object.entries(entries)) {
      words(en).forEach((word) => english.add(word))
      words(pl).forEach((word) => polish.add(word))
    }
  }
  add(JSON.parse(fs.readFileSync("data/itemLocalisation.en-pl.json", "utf8")))
  add(JSON.parse(fs.readFileSync("data/itemLocalisation.dos1-ee.en-pl.json", "utf8")))
  const dos2 = JSON.parse(fs.readFileSync("data/itemLocalisation.dos2-de.en-pl.json", "utf8"))
  add({ ...dos2.names, ...dos2.selectors })
  const polishOnly = (word: string) => polish.has(word) && !english.has(word)
  const offenders = new Set<string>()
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    const { recipes } = JSON.parse(fs.readFileSync(`data/library/recipes/${game}.json`, "utf8")) as {
      recipes: { result: { name: string }; ingredients: { name: string }[] }[]
    }
    for (const recipe of recipes)
      for (const { name } of [recipe.result, ...recipe.ingredients]) {
        const tokens = words(name)
        if (tokens.length && tokens.filter(polishOnly).length * 2 > tokens.length) offenders.add(name)
      }
  }
  assert.deepEqual([...offenders], [])
})
