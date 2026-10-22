import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { generateData } from "../../scripts/generate-data"
import type { CatalogData } from "../main/domain/types"

test("tag labels and effect vocabulary are Polish, never an untranslated English fallback", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dos-generated-"))
  try {
    await generateData(directory)
    const localisation: Record<string, Record<string, { en: string; pl?: string }>> = JSON.parse(
      await fs.readFile("data/tagLocalisation.json", "utf8"),
    )
    for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
      const catalog: CatalogData = JSON.parse(
        await fs.readFile(path.join(directory, `data/catalog-${game}.json`), "utf8"),
      )
      if (game !== "dos1") {
        for (const slug of ["milk-and-honey", "pizza-dough", "arrow"]) {
          const recipes = catalog.recipes.filter((row) => row.result.slug === slug)
          assert.equal(recipes.length, 1, `${game}: ${slug}`)
          assert.ok(recipes[0].source)
          if (slug === "arrow") assert.equal(recipes[0].remarks, "Serves No Function")
          else assert.ok(recipes[0].notes)
          assert.equal(recipes[0].sourceRecipeIds?.length, 2)
        }
      }
      const labels = Object.fromEntries(catalog.tags.map((tag) => [tag.tag, tag.label]))
      const dos1 = game === "dos1"
      const dexterity = dos1 ? "Zwinność" : "Zręczność"
      const speed = dos1 ? "Prędkość" : "Szybkość"
      assert.equal(labels["Cechy/Zwinność"] ?? dexterity, dexterity, game)
      assert.equal(labels["Cechy/Szybkość"] ?? speed, speed, game)
      assert.equal(labels["Cechy/Unik"] ?? "Unik", "Unik", game)
      assert.equal(labels["Typ/Pasy"] ?? "Pas", "Pas", game)
      const english = catalog.tags.filter((tag) => {
        const entry = localisation[game]?.[tag.tag]
        return entry && !entry.pl && tag.label === entry.en
      })
      assert.deepEqual(
        english.map((tag) => `${tag.tag}: ${tag.label}`),
        [],
        game,
      )
      for (const row of catalog.recipes)
        for (const [en, label] of Object.entries(row.effectLabels ?? {}))
          assert.notEqual(label.toLocaleLowerCase(), en, `${game} ${row.id}: ${en}`)
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
