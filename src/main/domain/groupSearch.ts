import { Item } from "./item"
import type { ItemGroups } from "./itemGroup"
import type { Recipe, RecipeSearchScope } from "./recipe"
import { TextKey } from "./textKey"

/** `#Name` or `#"Name with spaces"` in a search names an item group. */
const GROUP_TOKEN = /#"([^"]+)"|#(\S+)/g

/** A search split into the groups it names and the remaining text. */
export class GroupQuery {
  readonly groups: string[] = []
  readonly text: string

  constructor(query: string) {
    const text = query.replace(GROUP_TOKEN, (_, quoted: string | undefined, bare: string | undefined) => {
      this.groups.push(quoted ?? bare!)
      return " "
    })
    this.text = text.replace(/\s+/g, " ").trim()
  }

  /** The search that opens a group: its name, or its id when another group shares the name. */
  static token(item: { name: string; groupId?: string }): string {
    const name = Item.displayName(item.name)
    const label = item.groupId && TextKey.item(name) !== TextKey.item(item.groupId) ? item.groupId : name
    return /\s/.test(label) ? `#"${label}"` : `#${label}`
  }
}

/** Finds a catalog's groups by the names readers type and narrows its recipes to them. */
export class GroupSearch {
  private readonly ids = new Map<string, string>()

  constructor(
    private readonly groups: ItemGroups,
    private readonly recipes: Recipe[],
  ) {
    // Ids first: upgrade groups that share a name keep apart by their suffixed id.
    for (const group of Object.values(groups)) this.ids.set(TextKey.item(group.id), group.id)
    for (const group of Object.values(groups)) this.alias(Item.displayName(group.name), group.id)
    for (const row of recipes)
      for (const item of row.ingredients)
        if (item.groupId && item.namePl) this.alias(Item.displayName(item.namePl), item.groupId)
  }

  /** A group answers to its id, its English name and its Polish name, ignoring case, spaces and dashes. */
  resolve(name: string): string | undefined {
    const wanted = TextKey.item(name)
    return wanted ? this.ids.get(wanted) : undefined
  }

  /**
   * Narrows the recipes to the groups the query names: as a product, the group's members; as an
   * ingredient, recipes that take the group. Unknown names stay ordinary search text.
   */
  apply(query: string, scope: RecipeSearchScope): { rows: Recipe[]; query: string } {
    const parsed = new GroupQuery(query)
    const unknown: string[] = []
    let rows: Recipe[] | undefined
    for (const name of parsed.groups) {
      const id = this.resolve(name)
      if (!id) {
        unknown.push(name.includes(" ") ? name : `#${name}`)
        continue
      }
      const members = scope === "ingredient" ? [] : this.groups[id].rows(this.recipes)
      const users = scope === "result" ? [] : this.recipes.filter((row) => row.usesGroup(id))
      const matching = [...new Map([...members, ...users].map((row) => [row.id, row])).values()]
      // Several groups narrow together.
      const kept = rows ? new Set(rows.map((row) => row.id)) : undefined
      rows = kept ? matching.filter((row) => kept.has(row.id)) : matching
    }
    return { rows: rows ?? this.recipes, query: [...unknown, parsed.text].filter(Boolean).join(" ") }
  }

  private alias(label: string, id: string) {
    if (!this.ids.has(TextKey.item(label))) this.ids.set(TextKey.item(label), id)
  }
}
