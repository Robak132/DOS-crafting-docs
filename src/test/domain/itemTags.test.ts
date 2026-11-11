import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { test } from "node:test"
import { Recipe, type RecipeData } from "../../main/domain/recipe"
import { RecipeStats } from "../../main/domain/recipeStats"
import { tagHierarchy } from "../../main/domain/tagHierarchy"
import type { UpgradeData } from "../../main/domain/upgrade"

test("sidebar statistics count product tags rather than stale recipe or ingredient categories", () => {
  const recipe = new Recipe({
    id: "scroll",
    result: { name: "Scroll", tags: ["Scrolls", "Ingredients"] },
    ingredients: [{ name: "Knife", tags: ["Weapons"] }],
    tags: ["Ingredients"],
    requirements: "",
    notes: "",
    remarks: "",
    source: "",
  })
  assert.deepEqual(
    new RecipeStats([recipe]).tags().map((tag) => tag.tag),
    ["Category", "Ingredients", "Scrolls"],
  )
})

test("recipe rows carry their result's tags and every item reference is tagged for its own game only", async () => {
  for (const game of ["dos1", "dos2", "dos2-overhaul"]) {
    const source: { recipes: RecipeData[]; upgrades: UpgradeData[] } = JSON.parse(
      await fs.readFile(`data/library/recipes/${game}.json`, "utf8"),
    )
    const refs = [
      ...source.recipes.flatMap((row) => [row.result, ...row.ingredients]),
      ...source.upgrades.flatMap((row) => [row.target, ...row.ingredients]),
    ]
    for (const row of source.recipes) assert.deepEqual(row.tags, row.result.tags, row.id)
    const modeTag = ({ dos1: "DOS1", dos2: "DOS2" } as Record<string, string>)[game] ?? "DOS2-CO"
    for (const item of refs) {
      if (item.tags.some((tag) => tagHierarchy.isCategory(tag))) {
        assert.deepEqual(
          item.tags.filter((tag) => ["DOS1", "DOS2", "DOS2-CO"].includes(tag)),
          [modeTag],
          item.name,
        )
      }
    }
  }
})
