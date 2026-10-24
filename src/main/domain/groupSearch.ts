import { groupItemRows, isItemGroup, type ItemGroups } from "./itemGroups"
import { itemIconKey } from "./itemIcons"
import { displayItemName } from "./itemName"
import type { RecipeRow } from "./recipes"
import type { RecipeSearchScope } from "./recipeView"

/** `#Name` or `#"Name with spaces"` in a search names an item group. */
const GROUP_TOKEN = /#"([^"]+)"|#(\S+)/g

export function parseGroupQuery(query: string): { groups: string[]; text: string } {
  const groups: string[] = []
  const text = query.replace(GROUP_TOKEN, (_, quoted: string | undefined, bare: string | undefined) => {
    groups.push(quoted ?? bare!)
    return " "
  })
  return { groups, text: text.replace(/\s+/g, " ").trim() }
}

/** A group answers to its id, its English name and its Polish name, ignoring case, spaces and dashes. */
export function resolveGroup(name: string, groups: ItemGroups, recipes: RecipeRow[]): string | undefined {
  const wanted = itemIconKey(name)
  if (!wanted) return undefined
  const names = new Map<string, string>()
  // Ids first: upgrade groups that share a name keep apart by their suffixed id.
  for (const group of Object.values(groups)) names.set(itemIconKey(group.id), group.id)
  const add = (label: string, id: string) => {
    if (!names.has(itemIconKey(label))) names.set(itemIconKey(label), id)
  }
  for (const group of Object.values(groups)) add(displayItemName(group.name), group.id)
  for (const row of recipes)
    for (const item of row.ingredients) if (item.groupId && item.namePl) add(displayItemName(item.namePl), item.groupId)
  return names.get(wanted)
}

/**
 * Narrows the rows to the named groups: as a product, the group's members; as an ingredient,
 * recipes that take the group. Unknown names stay ordinary search text.
 */
export function applyGroupQuery(
  recipes: RecipeRow[],
  groups: ItemGroups,
  query: string,
  scope: RecipeSearchScope,
): { rows: RecipeRow[]; query: string } {
  const parsed = parseGroupQuery(query)
  const unknown: string[] = []
  let rows: RecipeRow[] | undefined
  for (const name of parsed.groups) {
    const id = resolveGroup(name, groups, recipes)
    if (!id) {
      unknown.push(name.includes(" ") ? name : `#${name}`)
      continue
    }
    const members = scope === "ingredient" ? [] : groupItemRows(recipes, groups[id])
    const users =
      scope === "result"
        ? []
        : recipes.filter((row) => row.ingredients.some((item) => isItemGroup(item) && item.groupId === id))
    const matching = [...new Map([...members, ...users].map((row) => [row.id, row])).values()]
    // Several groups narrow together.
    const kept = rows ? new Set(rows.map((row) => row.id)) : undefined
    rows = kept ? matching.filter((row) => kept.has(row.id)) : matching
  }
  return { rows: rows ?? recipes, query: [...unknown, parsed.text].filter(Boolean).join(" ") }
}

/** The search that opens a group: its name, or its id when another group shares the name. */
export function groupSearchToken(item: { name: string; groupId?: string }): string {
  const name = displayItemName(item.name)
  const label = item.groupId && itemIconKey(name) !== itemIconKey(item.groupId) ? item.groupId : name
  return /\s/.test(label) ? `#"${label}"` : `#${label}`
}
