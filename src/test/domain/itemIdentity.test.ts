import assert from "node:assert/strict"
import fs from "node:fs"
import { test } from "node:test"
import { CatalogBuilder } from "../../main/domain/catalogBuilder"
import { Recipe } from "../../main/domain/recipe"
import { TextKey } from "../../main/domain/textKey"
import { TooltipIndex } from "../../main/domain/tooltipIndex"

const read = (path: string) => JSON.parse(fs.readFileSync(path, "utf8"))

test("container and wearable Backpacks retain separate game identities in the combined catalog", () => {
  const sources = Object.fromEntries(
    ["dos1", "dos2", "dos2-overhaul"].map((game) => [
      game,
      read(`data/library/recipes/${game}.json`).recipes.map(Recipe.from),
    ]),
  ) as ConstructorParameters<typeof CatalogBuilder>[0]
  const catalog = new CatalogBuilder(sources, {}).build()["dos2-overhaul"]
  const backpacks = catalog.recipes.filter((row) => row.result.name === "Backpack")
  assert.equal(backpacks.length, 2)
  const container = backpacks.find((row) => row.result.statsId === "CONT_Backpack_A")!
  const wearable = backpacks.find((row) => row.result.statsId === "ARM_Backpack")!
  assert.ok(container)
  assert.ok(wearable)
  assert.equal(container.result.slug, "backpack")
  assert.equal(wearable.result.slug, "backpack-2")
  const index = new TooltipIndex(catalog.recipes)
  assert.deepEqual(index.recipesFor(container.result), [container])
  assert.deepEqual(index.recipesFor(wearable.result), [wearable])
  assert.equal(index.find(container.result.slug!, "Backpack"), container.result)
  assert.equal(index.find(wearable.result.slug!, "Backpack"), wearable.result)

  assert.equal(
    container.with({ ingredients: [wearable.result] }).uses(container.result.slug, TextKey.names("Backpack")),
    false,
  )
})
