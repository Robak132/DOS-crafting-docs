import type { RecipeItem, RecipeRow } from "./recipes"

/** Every product of one craft: the main result first, then the items made alongside it. */
export function recipeResults(recipe: Pick<RecipeRow, "result" | "extraResults">): RecipeItem[] {
  return recipe.extraResults?.length ? [recipe.result, ...recipe.extraResults] : [recipe.result]
}
