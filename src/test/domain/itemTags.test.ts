import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { test } from "node:test"
import { collectRecipeStats, type RecipeRow, type RecipeUpgrade } from "../../main/domain/recipes"

test("sidebar statistics count product tags rather than stale recipe or ingredient categories", () => {
  const recipe: RecipeRow = {
    id: "scroll",
    result: { name: "Scroll", tags: ["Typ/Zwoje", "Typ/Magia"] },
    ingredients: [{ name: "Knife", tags: ["Typ/Bron"] }],
    tags: ["Typ/Skladniki"],
    requirements: "",
    notes: "",
    remarks: "",
    source: "",
  }
  assert.deepEqual(
    collectRecipeStats([recipe]).tags.map((tag) => tag.tag),
    ["Typ/Magia", "Typ/Zwoje"],
  )
})

test("saved item types are consistent across recipe references and distinguish materials, equipment and containers", async () => {
  const expected: Record<string, Record<string, string>> = {
    dos1: {
      "Random Air Scroll": "Zwoje",
      "Plate Scraps": "Skladniki",
      Sinew: "Skladniki",
      "Battered Cooking Pot": "Pancerz",
    },
    dos2: {
      "Acid Spores Scroll": "Zwoje",
      "Blank Air Skillbook": "Ksiegi-umiejetnosci",
      "Plate Scraps": "Skladniki",
      "Mortar And Pestle": "Narzedzia",
    },
    "dos2-overhaul": {
      "Air Bow": "Bron",
      "Magic Altar": "Stanowiska-i-pojemniki",
      "Dye Making Machine": "Stanowiska-i-pojemniki",
      "Crafter's Hammer": "Narzedzia",
      "Giant Magic Armor": "Mikstury-i-jedzenie",
      "Empty vial": "Skladniki",
    },
  }
  for (const [game, names] of Object.entries(expected)) {
    const source: { recipes: RecipeRow[]; upgrades: RecipeUpgrade[] } = JSON.parse(
      await fs.readFile(`data/library/recipes/${game}.json`, "utf8"),
    )
    const refs = [
      ...source.recipes.flatMap((row) => [row.result, ...row.ingredients]),
      ...source.upgrades.flatMap((row) => [row.target, ...row.ingredients]),
    ]
    for (const [name, type] of Object.entries(names)) {
      const matches = refs.filter((item) => item.name === name)
      assert.ok(matches.length, `${game}: ${name}`)
      for (const item of matches) {
        assert.ok(item.tags.includes(`Typ/${type}`), `${game}: ${name} must be ${type}`)
      }
    }
    for (const row of source.recipes) assert.deepEqual(row.tags, row.result.tags, row.id)
    const modeTag = game === "dos1" ? "DOS1" : game === "dos2" ? "DOS2" : "DOS2-CO"
    for (const item of refs) {
      if (item.tags.some((tag) => tag.startsWith("Typ/"))) {
        assert.deepEqual(
          item.tags.filter((tag) => ["DOS1", "DOS2", "DOS2-CO"].includes(tag)),
          [modeTag],
          item.name,
        )
      }
      assert.ok(!item.tags.some((tag) => ["Zrecznosc", "Percepcja", "Charyzma"].includes(tag)), item.name)
    }
  }
})

test("saved magical weapons, materials and stations preserve their additional tags", async () => {
  const source: { recipes: RecipeRow[] } = JSON.parse(
    await fs.readFile("data/library/recipes/dos2-overhaul.json", "utf8"),
  )
  const refs = source.recipes.flatMap((row) => [row.result, ...row.ingredients])
  for (const [name, tags] of [
    ["Air Bow", ["Typ/Bron", "Typ/Magia"]],
    ["Pixie Dust", ["Typ/Skladniki", "Typ/Magia"]],
    ["Magic Altar", ["Typ/Stanowiska-i-pojemniki", "Typ/Magia"]],
  ] as const) {
    const matches = refs.filter((item) => item.name === name)
    assert.ok(matches.length, name)
    for (const item of matches) for (const tag of tags) assert.ok(item.tags.includes(tag), `${name}: ${tag}`)
  }
  for (const item of refs.filter((item) => ["Plate Scraps", "Sinew"].includes(item.name))) {
    assert.ok(!item.tags.includes("Typ/Bron") && !item.tags.includes("Typ/Pancerz"), item.name)
  }
})
