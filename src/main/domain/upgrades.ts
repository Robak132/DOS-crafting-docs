import type { ItemGroups } from "./itemGroups"
import type { RecipeUpgrade } from "./recipes"
import { normalizeSearch } from "./recipeView"
import { isTagWithin } from "./tagTree"

/**
 * Upgrades that apply to the item: membership in the target's group when the catalog resolved one,
 * otherwise the target category (e.g. one for any weapon applies to a bow).
 */
export function upgradesForItem(
  upgrades: RecipeUpgrade[],
  itemTags: string[],
  itemSlug?: string,
  groups?: ItemGroups,
): RecipeUpgrade[] {
  return upgrades.filter((upgrade) => {
    const resolved = (upgrade.targets ?? []).flatMap((target) => (target.groupId ? [groups?.[target.groupId]] : []))
    if (resolved.length && resolved.every(Boolean))
      return resolved.some((group) => group!.members.some((member) => member.slug === itemSlug))
    return upgrade.targetTags.some((target) => itemTags.some((tag) => isTagWithin(tag, target)))
  })
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
