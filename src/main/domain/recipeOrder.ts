import type { Lang } from "./item"
import type { Recipe } from "./recipe"

export type RecipeSort = "default" | "name" | "level" | "ingredients"
export const RECIPE_SORTS: readonly RecipeSort[] = ["default", "name", "level", "ingredients"]

/** An order of recipes for display; ties fall back to the result name. "default" keeps the catalog order. */
export class RecipeOrder {
  constructor(
    private readonly sort: RecipeSort,
    private readonly lang: Lang = "pl",
  ) {}

  apply(recipes: Recipe[]): Recipe[] {
    if (this.sort === "default") return recipes
    return [...recipes].sort((a, b) => this.key(a) - this.key(b) || this.name(a).localeCompare(this.name(b), this.lang))
  }

  private name(recipe: Recipe): string {
    return recipe.result.shownName(this.lang)
  }

  private key(recipe: Recipe): number {
    if (this.sort === "level") return recipe.requirementList.level()
    if (this.sort === "ingredients") return recipe.ingredients.length
    return 0
  }
}
