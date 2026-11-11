import { GroupQuery } from "./groupSearch"
import { Item, type ItemData } from "./item"
import type { ItemGroups } from "./itemGroup"
import { TextKey } from "./textKey"

export type SearchSuggestion = {
  key: string
  en: string
  pl?: string
  icon?: string
  /** The text the search box takes when the suggestion is picked; a group fills its #token. */
  token?: string
}

type Entry = { suggestion: SearchSuggestion; names: string[] }

/** How well a name fits what was typed: a name that starts with it, then a word that does, then anywhere. */
function rank(name: string, typed: string): number | undefined {
  if (name.startsWith(typed)) return 0
  if (name.includes(` ${typed}`)) return 1
  return name.includes(typed) ? 2 : undefined
}

/** Item and group names to complete the search with, in English and Polish. */
export class SuggestionIndex {
  private readonly items: Entry[]
  private readonly groups: Entry[]

  constructor(items: ItemData[], groups: ItemGroups = {}) {
    const seen = new Set<string>()
    this.items = items.flatMap((item) => {
      const key = item.slug ?? item.name
      // Distinct items that share both names would show as the same line; one is enough to complete the text.
      const shown = `${item.name}|${item.namePl ?? ""}`
      if (seen.has(key) || seen.has(shown) || item.selectorTag || item.name.startsWith("#")) return []
      seen.add(key).add(shown)
      return [this.entry({ key, en: item.name, pl: item.namePl, icon: item.icon })]
    })
    this.groups = Object.values(groups).map((group) => {
      const name = Item.displayName(group.name)
      return this.entry({
        key: `#${group.id}`,
        en: name,
        token: GroupQuery.token({ name: group.name, groupId: group.id }),
      })
    })
  }

  private entry(suggestion: SearchSuggestion): Entry {
    const names = [suggestion.en, suggestion.pl].filter((name): name is string => Boolean(name)).map(TextKey.search)
    return { suggestion, names }
  }

  /** The best matches for the typed text; "#" asks for groups. */
  suggest(query: string, limit = 8): SearchSuggestion[] {
    const grouped = query.trimStart().startsWith("#")
    const typed = TextKey.search(query.trim().replace(/^#"?/, "").replace(/"$/, "")).trim()
    if (!typed) return []
    const scored: Array<{ suggestion: SearchSuggestion; score: number; length: number }> = []
    for (const { suggestion, names } of grouped ? this.groups : this.items) {
      const ranks = names.map((name) => rank(name, typed)).filter((value) => value !== undefined)
      if (!ranks.length) continue
      // A name already typed in full has nothing left to complete.
      if (names.includes(typed)) continue
      scored.push({ suggestion, score: Math.min(...ranks), length: Math.min(...names.map((name) => name.length)) })
    }
    scored.sort(
      (a, b) => a.score - b.score || a.length - b.length || a.suggestion.en.localeCompare(b.suggestion.en, "en"),
    )
    return scored.slice(0, limit).map((entry) => entry.suggestion)
  }
}
