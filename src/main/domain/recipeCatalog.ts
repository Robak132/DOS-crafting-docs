import type { PageSummary } from "./types"
import {
  collectRecipeStats,
  localizeItemForCatalog,
  type RecipeData,
  type RecipeCatalog,
  type RecipeRow,
  type RecipeUpgrade,
} from "./recipes"
import { itemNameKeys, recipeUsesItem } from "./recipeView"

export type RecipeSources = Record<RecipeCatalog, RecipeRow[]>

export function buildCatalogs(
  sources: RecipeSources,
  pages: PageSummary[],
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
  const categories = new Map(
    pages.filter((page) => page.categoryPage).flatMap((page) => page.tags.map((tag) => [tag, page.title] as const)),
  )
  const displayLabels = new Map(
    Object.entries(labels).map(([tag, label]) => [
      tag
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replaceAll("ł", "l")
        .toLowerCase(),
      label,
    ]),
  )
  const build = (game: RecipeCatalog): RecipeData => {
    const recipes = sources[game].map((row) => ({
      ...row,
      result: localizeItemForCatalog(row.result, game),
      ...(row.extraResults && { extraResults: row.extraResults.map((item) => localizeItemForCatalog(item, game)) }),
      ingredients: row.ingredients.map((item) => localizeItemForCatalog(item, game)),
    }))
    const data: RecipeData = { recipes, ...collectRecipeStats(recipes, displayLabels) }
    data.tags.forEach((tag) => {
      tag.label = categories.get(tag.tag) ?? tag.label
    })
    return data
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
    for (const field of ["tags", "requirements", "selectors"] as const) {
      for (const stat of data[field]) {
        if (stat.label && !labels.has(stat.tag)) labels.set(stat.tag, stat.label)
      }
    }
  }
  const stats = collectRecipeStats(recipes)
  stats.tags.forEach((tag) => {
    tag.label = labels.get(tag.tag) ?? tag.label
  })
  stats.selectors.forEach((sel) => {
    sel.label = labels.get(sel.tag) ?? sel.label
  })
  return { recipes, ...stats }
}

type IngredientIndex = {
  bySlug: Map<string, Set<RecipeData["recipes"][number]>>
  byName: Map<string, Set<RecipeData["recipes"][number]>>
  order: Map<RecipeData["recipes"][number], number>
}
const ingredientIndexes = new WeakMap<RecipeData, IngredientIndex>()

/** Indeks użyć składników budowany raz dla katalogu, zamiast skanowania go na każdej stronie. */
export function recipesUsingItem(data: RecipeData, slug: string, names: Set<string>): RecipeData["recipes"] {
  let index = ingredientIndexes.get(data)
  if (!index) {
    index = { bySlug: new Map(), byName: new Map(), order: new Map() }
    const add = (map: IngredientIndex["bySlug"], key: string, recipe: RecipeData["recipes"][number]) => {
      const matches = map.get(key) ?? new Set()
      matches.add(recipe)
      map.set(key, matches)
    }
    data.recipes.forEach((recipe, position) => {
      index!.order.set(recipe, position)
      for (const item of recipe.ingredients) {
        if (item.slug) add(index!.bySlug, item.slug, recipe)
        for (const name of itemNameKeys(item.name, item.namePl)) add(index!.byName, name, recipe)
      }
    })
    ingredientIndexes.set(data, index)
  }
  const matches = new Set(index.bySlug.get(slug))
  for (const name of names) {
    for (const recipe of index.byName.get(name) ?? []) matches.add(recipe)
  }
  return [...matches]
    .filter((recipe) => recipeUsesItem(recipe, slug, names))
    .sort((a, b) => index!.order.get(a)! - index!.order.get(b)!)
}
