import type { RecipeUpgrade } from "./recipes"
import { normalizeSearch } from "./recipeView"

export function upgradeEffect(upgrade: RecipeUpgrade, lang: "pl" | "en"): string {
  return (lang === "pl" && upgrade.effect.pl) || upgrade.effect.en
}

export function upgradesForItem(upgrades: RecipeUpgrade[], itemTags: string[]): RecipeUpgrade[] {
  const tags = new Set(itemTags)
  return upgrades.filter((upgrade) => upgrade.targetTags.some((tag) => tags.has(tag)))
}

export function matchesUpgradeQuery(upgrade: RecipeUpgrade, query: string): boolean {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normalizeSearch)
  if (terms.length === 0) return true
  const text = normalizeSearch(
    [
      upgrade.effect.en,
      upgrade.effect.pl,
      ...[upgrade.target, ...upgrade.ingredients].flatMap((item) => [item.name, item.namePl, item.selectorTag]),
    ]
      .filter(Boolean)
      .join(" "),
  )
  return terms.every((term) => text.includes(term))
}
