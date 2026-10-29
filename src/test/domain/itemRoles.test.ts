import assert from "node:assert/strict"
import { test } from "node:test"
import { getCatalogItemRoles } from "../../main/domain/recipeItemRoles"
import type { RecipeItem, RecipeRow } from "../../main/domain/recipes"

const item = (slug: string): RecipeItem => ({ name: slug, slug, tags: [] })
const row = (result: string, ...ingredients: string[]): RecipeRow => ({
  id: `${result}:${ingredients.join("+")}`,
  result: item(result),
  ingredients: ingredients.map(item),
  tags: [],
  requirements: "",
  notes: "",
  remarks: "",
  source: "",
})
const page = (slug: string) => ({ slug, title: slug, tags: [] })

test("craft roles are computed per catalog, so a DOS2 recipe does not tint a DOS1 base ingredient", () => {
  const pages = [page("scraps"), page("armor"), page("knife"), page("orphan")]
  const roles = getCatalogItemRoles(pages, {
    dos1: { recipes: [row("armor", "scraps")] },
    dos2: { recipes: [row("scraps", "knife"), row("armor", "scraps")] },
    "dos2-overhaul": { recipes: [] },
  })
  // DOS1 cannot craft scraps: it is a plain base ingredient there (no role class).
  assert.equal(roles.dos1.scraps, undefined)
  assert.equal(roles.dos1.armor, "end")
  assert.equal(roles.dos1.knife, "dead")
  // DOS2 crafts scraps and uses them further.
  assert.equal(roles.dos2.scraps, "mid")
  assert.equal(roles.dos2.knife, undefined)
  assert.equal(roles["dos2-overhaul"].armor, "dead")
})
