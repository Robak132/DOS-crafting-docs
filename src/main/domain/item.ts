import { withKeys } from "./listKeys"
import { GroupMatcher } from "./groupMatcher"
import { TextKey } from "./textKey"

/** An item as stored in the recipe library and in the generated catalog JSON. */
export type ItemData = {
  /** Game identity (Stats ID); links the item to game data. Never shown. */
  statsId?: string
  /** Key of the item's icon, effect and description data, set during static generation. */
  dataKey?: string
  /** Catalog clarification for distinct items sharing their official game name. */
  nameQualifier?: { en: string; pl?: string }
  /** Confirmed game effects, embedded during static generation. */
  effect?: { en: string; pl?: string }
  /** Relative static asset URL, exported from this game’s inventory atlas. */
  icon?: string
  /** The game marks it unique (its Stats say so); shown in the unique rarity colour. */
  unique?: boolean
  craftingCategories?: string[]
  groupId?: string
  groupSize?: number
  /** Bazowa nazwa ENG (źródło w plikach / mapa lokalizacji). */
  name: string
  /** Opcjonalne tłumaczenie PL — przełączane w UI. */
  namePl?: string
  slug?: string
  tags: string[]
  selectorTag?: string
  /** Ilość poza linkiem, np. "x2" / "x3", losowa "x(1-3)" lub nieznana "x(?)". */
  quantity?: string
  /** Wynik losowany z puli: możliwe przedmioty z plików gry. Taki wynik nie ma własnej strony. */
  pool?: ItemData[]
  /** Element puli: najniższy poziom craftingu, od którego może wypaść (DOS1). */
  requirements?: string
}

export type Lang = "pl" | "en"

/** Losowa ilość: "x(1-3)" lub nieznany zakres "x(?)". */
const RANDOM_QUANTITY = /^x\((?:(\d+)-(\d+)|\?)\)$/i

/**
 * An item of a recipe, an upgrade or a game's inventory: a page item, a random pool or an ingredient group.
 * Its fields are exactly those of the JSON it was read from, so it serializes back unchanged.
 */
export class Item {
  declare statsId?: string
  declare dataKey?: string
  declare nameQualifier?: { en: string; pl?: string }
  declare effect?: { en: string; pl?: string }
  declare icon?: string
  declare unique?: boolean
  declare craftingCategories?: string[]
  declare groupId?: string
  declare groupSize?: number
  declare name: string
  declare namePl?: string
  declare slug?: string
  declare tags: string[]
  declare selectorTag?: string
  declare quantity?: string
  declare pool?: Item[]
  declare requirements?: string

  constructor(data: ItemData) {
    Object.assign(this, data)
    if (data.pool) this.pool = data.pool.map(Item.from)
  }

  static from(this: void, data: ItemData): Item {
    return data instanceof Item ? data : new Item(data)
  }

  /** A copy with some fields changed; the item itself stays as it is. */
  with(changes: Partial<ItemData>): Item {
    return new Item({ ...this, ...changes })
  }

  /** Data key of the name alone ("Sharp Piece Of Metal" → "sharppieceofmetal"). */
  get nameKey(): string {
    return TextKey.item(this.name)
  }

  /** Effects come from the game's Stats entry, so every item on one Stats ID shares them. */
  get effectKey(): string {
    return TextKey.item(this.statsId ?? this.name)
  }

  /** Key of the item's icon, effect and description data. */
  get resourceKey(): string {
    return this.dataKey ?? this.effectKey
  }

  /** Items paired with list keys that stay unique when an item repeats ("Rat's Tail + Rat's Tail"). */
  static keyed<T extends Item>(items: readonly T[]): [string, T][] {
    return withKeys(items, (item) => item.tooltipKey + (item.selectorTag ?? "") + (item.quantity ?? ""))
  }

  /** Quantities and translations do not change which game variant is being previewed. */
  get tooltipKey(): string {
    return JSON.stringify([this.statsId, this.slug, this.name, this.effect?.en, this.effect?.pl])
  }

  /** The keys of the English name. */
  nameKeys(): Set<string> {
    return TextKey.names(this.name)
  }

  /** The keys of the English and the Polish name. */
  allNameKeys(): Set<string> {
    return TextKey.names(this.name, this.namePl)
  }

  /** Group and selector names are stored as "#Water-Source"; people read "Water Source". */
  static displayName(name: string): string {
    return name.startsWith("#") ? name.slice(1).replaceAll("-", " ") : name
  }

  /** The name a reader sees in the chosen language. */
  shownName(lang: Lang): string {
    return Item.displayName(lang === "pl" ? (this.namePl ?? this.name) : this.name)
  }

  /** The Polish name, when it differs from the English one. */
  get polishTitle(): string | undefined {
    return this.namePl && this.namePl !== this.name ? Item.displayName(this.namePl) : undefined
  }

  /** "×2", a random "×(1–3)", an unknown "×(?)", or "" without a quantity. */
  get quantityLabel(): string {
    if (!this.quantity) return ""
    const random = RANDOM_QUANTITY.exec(this.quantity.trim())
    if (random) return random[1] ? `×(${random[1]}–${random[2]})` : "×(?)"
    const match = /^x?(\d+)x?$/i.exec(this.quantity.trim())
    const normalized = match ? `x${match[1]}` : this.quantity.trim().toLowerCase()
    const digits = normalized.replace(/^x/i, "")
    return digits ? `×${digits}` : ""
  }

  /** An ingredient group (resolved or not) rather than one item. */
  isGroup(): boolean {
    return Boolean(this.groupId || GroupMatcher.for(this))
  }

  /** Whether one of the names matches these keys, or the slug matches when both sides have one. */
  matches(slug: string | undefined, nameKeys: Set<string>): boolean {
    if (slug && this.slug) return this.slug === slug
    return [...this.allNameKeys()].some((key) => nameKeys.has(key))
  }

  /**
   * Data follows the game identity. A Stats ID behind several item pages is generic (one
   * "WPN_Sword_1H" for several sword templates) or one item listed twice, so those pages keep
   * their own name as the key.
   */
  static assignDataKeys(items: Item[]): void {
    const pages = new Map<string, Set<string>>()
    for (const item of items)
      if (item.statsId && item.slug) pages.set(item.statsId, (pages.get(item.statsId) ?? new Set()).add(item.slug))
    for (const item of items)
      if (item.statsId && !item.selectorTag)
        item.dataKey = TextKey.item((pages.get(item.statsId)?.size ?? 0) > 1 ? item.name : item.statsId)
  }
}
