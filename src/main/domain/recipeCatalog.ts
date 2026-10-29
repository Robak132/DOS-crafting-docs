import {
  collectRecipeStats,
  localizeItemForCatalog,
  type RecipeData,
  type RecipeCatalog,
  type RecipeRow,
  type RecipeUpgrade,
} from "./recipes"

export type RecipeSources = Record<RecipeCatalog, RecipeRow[]>

export function buildCatalogs(
  sources: RecipeSources,
  labels: Record<string, string>,
  upgradeSources: Record<RecipeCatalog, RecipeUpgrade[]> = { dos1: [], dos2: [], "dos2-overhaul": [] },
) {
  const localizeUpgrades = (game: RecipeCatalog, upgrades: RecipeUpgrade[]): RecipeUpgrade[] =>
    upgrades.map((upgrade) => {
      const effect = localizeItemForCatalog({ name: upgrade.effect.en, namePl: upgrade.effect.pl, tags: [] }, game)
      return {
        ...upgrade,
        effect: { en: upgrade.effect.en, pl: upgrade.effect.pl ?? effect.namePl },
        target: localizeItemForCatalog(upgrade.target, game),
        ingredients: upgrade.ingredients.map((item) => localizeItemForCatalog(item, game)),
      }
    })
  const build = (game: RecipeCatalog): RecipeData => {
    const recipes = sources[game].map((row) => ({
      ...row,
      result: localizeItemForCatalog(row.result, game),
      ...(row.extraResults && { extraResults: row.extraResults.map((item) => localizeItemForCatalog(item, game)) }),
      ingredients: row.ingredients.map((item) => localizeItemForCatalog(item, game)),
    }))
    return { recipes, ...collectRecipeStats(recipes, labels) }
  }
  const dos1 = build("dos1")
  const dos2 = build("dos2")
  const overhaul = build("dos2-overhaul")
  dos1.upgrades = localizeUpgrades("dos1", upgradeSources.dos1)
  dos2.upgrades = localizeUpgrades("dos2", upgradeSources.dos2)
  const combined = mergeCatalogs([dos2, overhaul])
  combined.upgrades = [...dos2.upgrades, ...localizeUpgrades("dos2-overhaul", upgradeSources["dos2-overhaul"])]
  return { dos1, dos2, "dos2-overhaul": combined }
}

function mergeCatalogs(catalogs: RecipeData[]): RecipeData {
  const recipes = catalogs
    .flatMap((data) => data.recipes)
    .sort((a, b) => a.result.name.localeCompare(b.result.name, "pl"))
  // Przelicz z połączonej listy — sumowanie liczników z katalogów dublowałoby te same przedmioty.
  const labels = new Map<string, string>()
  for (const data of catalogs) {
    for (const field of ["tags", "requirements"] as const) {
      for (const stat of data[field]) {
        if (stat.label && !labels.has(stat.tag)) labels.set(stat.tag, stat.label)
      }
    }
  }
  const stats = collectRecipeStats(recipes)
  stats.tags.forEach((tag) => {
    tag.label = labels.get(tag.tag) ?? tag.label
  })
  return { recipes, ...stats }
}
