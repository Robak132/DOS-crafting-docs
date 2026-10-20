import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { test } from "node:test"
import { renderToString } from "preact-render-to-string"
import { ItemTooltip, type ItemDescription } from "../../main/components/ItemTooltip"
import { ItemTable } from "../../main/components/ItemTable"
import { itemIconKey } from "../../main/domain/itemIcons"
import type { RecipeRow } from "../../main/domain/recipes"

test("the game description of Pastel Red Dye renders in item lists and tooltips in both languages", async () => {
  const descriptions: Record<string, Record<string, ItemDescription>> = JSON.parse(
    await fs.readFile("data/itemDescriptions.json", "utf8"),
  )
  const catalog: { recipes: RecipeRow[] } = JSON.parse(
    await fs.readFile("data/library/recipes/dos2-overhaul.json", "utf8"),
  )
  const recipe = catalog.recipes.find((r) => r.result.name === "Pastel Red Dye")!
  assert.ok(recipe)
  const description = descriptions["dos2-overhaul"][itemIconKey(recipe.result.name)]
  const expected = "A kiss of red pepper, the brightest burnishing for your equipment."
  assert.equal(description?.en, expected)
  assert.ok(!Object.keys(descriptions["dos2-overhaul"]).some((key) => key.startsWith("fontcolor")))
  for (const lang of ["pl", "en"] as const) {
    assert.ok(
      renderToString(
        <ItemTooltip item={recipe.result} lang={lang} recipes={[recipe]} description={description} />,
      ).includes(expected),
    )
    assert.ok(
      renderToString(
        <ItemTable
          recipes={[recipe]}
          labels={{}}
          itemHref={(slug) => slug}
          descriptions={descriptions["dos2-overhaul"]}
          lang={lang}
        />,
      ).includes(expected),
    )
  }
})
