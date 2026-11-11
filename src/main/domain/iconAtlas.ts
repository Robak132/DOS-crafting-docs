import type { Game } from "./game"
import type { Item } from "./item"

/** Icon file of each item's resource key, per game, as exported to data/itemIcons.json. */
export type ItemIconMap = Record<Game, Record<string, string>>

/** The inventory icons of one game. */
export class IconAtlas {
  constructor(
    private readonly icons: ItemIconMap,
    private readonly game: Game,
  ) {}

  /** The item's icon; groups and selectors have none of their own. */
  iconOf(item: Item): string | undefined {
    if (item.selectorTag) return undefined
    return this.icons[this.game][item.resourceKey]
  }
}
