import type { Item } from "./item"
import type { Recipe } from "./recipe"

/** Recipes with the same products, shown as variants sharing one result cell. */
export class ResultGroup {
  readonly variants: Recipe[] = []
  readonly result: Item
  readonly results: Item[]

  private constructor(
    readonly key: string,
    first: Recipe,
  ) {
    this.result = first.result
    this.results = first.results()
    this.variants.push(first)
  }

  /** The recipes grouped by their products, in the order the products first appear. */
  static of(recipes: Recipe[]): ResultGroup[] {
    const groups = new Map<string, ResultGroup>()
    for (const recipe of recipes) {
      const key = ResultGroup.keyOf(recipe)
      const group = groups.get(key)
      if (group) group.variants.push(recipe)
      else groups.set(key, new ResultGroup(key, recipe))
    }
    return [...groups.values()]
  }

  /** The products with their quantities; a modified ingredient also keys on the modification. */
  private static keyOf(recipe: Recipe): string {
    const modification = recipe.transformsIngredient === undefined ? "" : `@${recipe.notes}`
    return (
      recipe
        .results()
        .map((item) => item.tooltipKey + (item.quantity ? "@" + item.quantity : ""))
        .join("+") + modification
    )
  }
}

/** The columns of the recipe table. */
export const RECIPE_COLUMNS = [
  { key: "result", label: "Przedmiot" },
  { key: "ingredients", label: "Receptura" },
  { key: "requirements", label: "Wymagania" },
  { key: "tags", label: "Tagi" },
  { key: "source", label: "Źródło" },
] as const

/** DOS2 / Overhaul nie mają wymagań craftingu — bez kolumny Wymagania. */
export function recipeColumns(showRequirements: boolean) {
  return RECIPE_COLUMNS.filter((col) => showRequirements || col.key !== "requirements")
}
