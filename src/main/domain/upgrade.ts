import { Item, type ItemData } from "./item"
import { Recipe } from "./recipe"

/** An upgrade as stored in the recipe library and in the generated catalog JSON. */
export type UpgradeData = {
  id: string
  effect: { en: string; pl?: string }
  target: ItemData
  /** The groups of items the upgrade applies to, resolved during data generation. */
  targets?: ItemData[]
  targetTags: string[]
  /** The game's crafting categories (ComboCategory) of the items it applies to, where the library knows them. */
  targetCategories?: string[]
  tags: string[]
  ingredients: ItemData[]
  requirements: string
  notes: string
  remarks: string
  source: string
}

/**
 * A modification of existing items (an effect added to a weapon, say), as the recipe library stores it. The
 * generated catalog has no upgrades: it lists each as an artificial item of its own ({@link item}), made by
 * ordinary recipes from the target and the ingredients ({@link recipes}).
 */
export class Upgrade {
  declare id: string
  declare effect: { en: string; pl?: string }
  declare target: Item
  declare targets?: Item[]
  declare targetTags: string[]
  declare targetCategories?: string[]
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

  /**
   * The crafts giving {@link item}, as the catalog lists them: the item to upgrade and the ingredients. An
   * upgrade resolved to several groups (one per equipment slot) gets one recipe for each.
   */
  recipes(): Recipe[] {
    const item = this.item()
    // Resolved to no catalog item at all: one recipe for the target as the library names it.
    const targets = this.targets?.some((target) => target.groupId) ? this.targets : [this.target]
    return targets.map(
      (target, index) =>
        new Recipe({
          id: targets.length > 1 ? `upgrade:${this.id}#${index + 1}` : `upgrade:${this.id}`,
          ingredients: [target, ...this.ingredients],
          result: item,
          tags: item.tags,
          // A resolved target applies through its group alone; one without catalog items applies to none.
          targetTags: this.targets ? [] : this.targetTags,
          requirements: this.requirements,
          notes: "",
          remarks: this.remarks,
          source: this.source,
        }),
    )
  }
}
