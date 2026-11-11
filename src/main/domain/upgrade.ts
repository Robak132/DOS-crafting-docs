import { Item, type ItemData } from "./item"
import type { ItemGroups } from "./itemGroup"
import { Recipe } from "./recipe"
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

/**
 * A modification of existing items (an effect added to a weapon, say). The catalog lists it as an artificial
 * item of its own ({@link item}), made by a recipe from the target and the ingredients ({@link recipe}).
 */
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

  /** The name a reader sees: "Wzmocnienie: Ataraksja (amulet)", in English "Boost: Ataraxian (amulet)". */
  title(lang: "pl" | "en"): string {
    const effect = lang === "pl" ? (this.effect.pl ?? this.effect.en) : this.effect.en
    // Many effects already name themselves a boost ("Wzmocnienie: pancerz (+1 Siła)", "Boosted Armor").
    if (/^(wzmocni|boost)/i.test(effect)) return effect
    return `${lang === "pl" ? "Wzmocnienie" : "Boost"}: ${effect}`
  }

  /**
   * The address of its item page, from the English name: "Boost: +10% Air Resistance" →
   * "boost-plus-10-percent-air-resistance". Upgrades with the same name share one page.
   */
  get slug(): string {
    const words = this.title("en")
      .toLowerCase()
      .replaceAll("+", " plus ")
      .replaceAll("%", " percent ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    return words.startsWith("boost") ? words : `boost-${words}`
  }

  /** The upgrade as an item: no game item, but listed, searched and filtered like one, under "Upgrades". */
  item(): Item {
    return new Item({
      slug: this.slug,
      name: this.title("en"),
      namePl: this.title("pl"),
      effect: { ...this.effect },
      tags: [...new Set([...this.tags, "Upgrades"])],
    })
  }

  /** The craft giving {@link item}: the item to upgrade (its resolved group when there is one) and the ingredients. */
  recipe(): Recipe {
    const item = this.item()
    const target = this.targets?.length === 1 ? this.targets[0] : this.target
    return new Recipe({
      id: `upgrade:${this.id}`,
      ingredients: [target, ...this.ingredients],
      result: item,
      tags: item.tags,
      requirements: this.requirements,
      notes: "",
      remarks: this.remarks,
      source: this.source,
    })
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

  /** Whether it takes the item as an ingredient: by its page, its name, or membership in an ingredient group. */
  uses(slug: string | undefined, nameKeys: Set<string>, groups?: ItemGroups): boolean {
    return this.ingredients.some((ingredient) =>
      ingredient.groupId
        ? Boolean(slug && groups?.[ingredient.groupId]?.includes(slug))
        : ingredient.matches(slug, nameKeys),
    )
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
