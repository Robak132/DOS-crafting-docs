import { Item, type ItemData } from "./item"
import type { ItemGroups } from "./itemGroup"
import { Requirements } from "./requirements"
import type { SearchQuery } from "./searchQuery"
import { tagHierarchy } from "./tagHierarchy"

/** An upgrade as stored in the recipe library and in the generated catalog JSON. */
export type UpgradeData = {
  id: string
  effect: { en: string; pl?: string }
  target: ItemData
  /** The groups of items the upgrade applies to, resolved during data generation. */
  targets?: ItemData[]
  targetTags: string[]
  tags: string[]
  ingredients: ItemData[]
  requirements: string
  notes: string
  remarks: string
  source: string
}

/** A modification of existing items (an effect added to a weapon, say), never an item of its own. */
export class Upgrade {
  declare id: string
  declare effect: { en: string; pl?: string }
  declare target: Item
  declare targets?: Item[]
  declare targetTags: string[]
  declare tags: string[]
  declare ingredients: Item[]
  declare requirements: string
  declare notes: string
  declare remarks: string
  declare source: string

  constructor(data: UpgradeData) {
    Object.assign(this, data)
    this.target = Item.from(data.target)
    if (data.targets) this.targets = data.targets.map(Item.from)
    this.ingredients = data.ingredients.map(Item.from)
  }

  static from(this: void, data: UpgradeData): Upgrade {
    return data instanceof Upgrade ? data : new Upgrade(data)
  }

  /** A copy with some fields changed; the upgrade itself stays as it is. */
  with(changes: Partial<UpgradeData>): Upgrade {
    return new Upgrade({ ...this, ...changes })
  }

  get requirementList(): Requirements {
    return new Requirements(this.requirements)
  }

  /**
   * Whether it applies to the item: membership in the target's group when the catalog resolved one,
   * otherwise the target category (e.g. one for any weapon applies to a bow).
   */
  appliesTo(itemTags: string[], itemSlug?: string, groups?: ItemGroups): boolean {
    const resolved = (this.targets ?? []).flatMap((target) => (target.groupId ? [groups?.[target.groupId]] : []))
    if (resolved.length && resolved.every(Boolean)) return resolved.some((group) => group!.includes(itemSlug))
    return this.targetTags.some((target) => itemTags.some((tag) => tagHierarchy.isWithin(tag, target)))
  }

  /** Whether the query finds it by effect, target or ingredients, in either language. */
  matches(query: SearchQuery): boolean {
    return query.matches([
      this.effect.en,
      this.effect.pl,
      ...[this.target, ...this.ingredients].flatMap((item) => [item.name, item.namePl, item.selectorTag]),
    ])
  }
}
