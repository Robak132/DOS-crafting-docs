import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { generateData } from "../../scripts/generate-data"
import { recipeResults } from "../main/domain/recipeResults"
import type { RecipeItem } from "../main/domain/recipes"
import type { CatalogData } from "../main/domain/types"

const key = (item: RecipeItem) => `${(item.selectorTag ?? item.name).toLowerCase()}@${item.quantity ?? ""}`
const keys = (items: RecipeItem[]) => JSON.stringify(items.map(key).sort((a, b) => a.localeCompare(b, "en")))

test("built catalogs have Polish labels and list every recipe once", async () => {
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

      // Same products from the same ingredients, or from a concrete item that a group ingredient already covers.
      const members = new Map(
        Object.entries(catalog.groups ?? {}).map(([id, group]) => [id, new Set(group.members.map((m) => m.name))]),
      )
      const seen = new Map<string, string>()
      for (const row of catalog.recipes) {
        const signature = JSON.stringify([keys(recipeResults(row)), keys(row.ingredients), row.requirements])
        assert.ok(!seen.has(signature), `${game}: ${row.id} repeats ${seen.get(signature)}`)
        seen.set(signature, row.id)
        row.ingredients.forEach((group, slot) => {
          const names = group.groupId ? members.get(group.groupId) : undefined
          if (!names) return
          const rest = keys(row.ingredients.filter((_, index) => index !== slot))
          const covered = catalog.recipes.find(
            (other) =>
              other !== row &&
              keys(recipeResults(other)) === keys(recipeResults(row)) &&
              other.requirements === row.requirements &&
              other.ingredients.some(
                (item, index) =>
                  !item.groupId &&
                  names.has(item.name) &&
                  (item.quantity ?? "") === (group.quantity ?? "") &&
                  keys(other.ingredients.filter((_, i) => i !== index)) === rest,
              ),
          )
          assert.ok(!covered, `${game}: ${covered?.id} is covered by ${row.id}`)
        })
      }
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})
