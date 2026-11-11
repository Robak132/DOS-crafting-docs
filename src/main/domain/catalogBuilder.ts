import { Catalog } from "./catalog"
import type { Game } from "./game"
import { CatalogLocalizer } from "./localisation"
import type { Recipe } from "./recipe"
import { RecipeStats } from "./recipeStats"
import type { Upgrade } from "./upgrade"

export type GameRecords<T> = Record<Game, T[]>

/**
 * Builds the three catalogs from the recipe library: DOS1, DOS2, and DOS2 with Overhaul, which also
 * contains every DOS2 recipe and upgrade. Items get their Polish names; the sources stay unchanged.
 */
export class CatalogBuilder {
  /**
   * @param recipes the library's recipes of each game
   * @param tagLabels labels of tags the hierarchy file does not name
   * @param upgrades the library's upgrades of each game
   */
  constructor(
    private readonly recipes: GameRecords<Recipe>,
    private readonly tagLabels: Record<string, string>,
    private readonly upgrades: GameRecords<Upgrade> = { dos1: [], dos2: [], "dos2-overhaul": [] },
  ) {}

  build(): Record<Game, Catalog> {
    const dos1 = this.catalog("dos1")
    const dos2 = this.catalog("dos2")
    const overhaul = this.catalog("dos2-overhaul")
    dos1.upgrades = this.localizedUpgrades("dos1")
    dos2.upgrades = this.localizedUpgrades("dos2")
    const combined = merge([dos2, overhaul])
    combined.upgrades = [...dos2.upgrades, ...this.localizedUpgrades("dos2-overhaul")]
    return { dos1, dos2, "dos2-overhaul": combined }
  }

  private catalog(game: Game): Catalog {
    const localizer = new CatalogLocalizer(game)
    return Catalog.of(
      this.recipes[game].map((row) => localizer.recipe(row)),
      this.tagLabels,
    )
  }

  private localizedUpgrades(game: Game): Upgrade[] {
    const localizer = new CatalogLocalizer(game)
    return this.upgrades[game].map((upgrade) => localizer.upgrade(upgrade))
  }
}

/** One catalog of several, recounted: adding up their counts would count shared items twice. */
function merge(catalogs: Catalog[]): Catalog {
  const recipes = catalogs
    .flatMap((data) => data.recipes)
    .sort((a, b) => a.result.name.localeCompare(b.result.name, "pl"))
  const labels = new Map<string, string>()
  for (const data of catalogs)
    for (const field of ["tags", "requirements"] as const)
      for (const stat of data[field]) if (stat.label && !labels.has(stat.tag)) labels.set(stat.tag, stat.label)
  const stats = new RecipeStats(recipes)
  const tags = stats.tags()
  tags.forEach((tag) => {
    tag.label = labels.get(tag.tag) ?? tag.label
  })
  return new Catalog({ recipes, tags, requirements: stats.requirements() })
}
