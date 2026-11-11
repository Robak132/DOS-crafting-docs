import { GroupMatcher } from "./groupMatcher"
import { Item } from "./item"
import { ItemGroup, type ItemGroups } from "./itemGroup"
import type { Recipe } from "./recipe"
import { tagHierarchy } from "./tagHierarchy"
import { TextKey } from "./textKey"
import type { Upgrade } from "./upgrade"

const words = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const slotWords: [RegExp, string][] = [
  [/\b(upperbody|chest|torso|body|robe|shirt)\b/, "Chest-Armour"],
  [/\b(gloves?|bracers|gauntlets)\b/, "Gloves"],
  [/\b(boots?|shoes)\b/, "Boots"],
  [/\b(helmet|helm|hat)\b/, "Helmets"],
  [/\b(pants|lowerbody|leggings|sarong)\b/, "Leggings"],
  [/\bbelts?\b/, "Belts"],
  [/\bshields?\b/, "Shields"],
]
// Material words of a target list ("Leather Upperbody, Gloves, …") and the items they cover.
const targetMaterials: [RegExp, RegExp][] = [
  [/^leather\b/, /\b(leather|light|ranger|rogue|shadow|hide)\b/],
  [
    /^(mage|cloth)\b/,
    /\b(mage|cloth|robe|aerotheurge|aerotheruge|geomancer|hydrosophist|necromancer|polymorph|pyrokinetic|pyromancer|summoning|summoner)\b/,
  ],
  [/^(warrior|plate|metal)\b/, /\b(warrior|metal|plate|scale|scalemail|chain)\b/],
  [/^(vanilla )?unique\b/, /\bunique\b/],
  [/^wooden\b/, /\bwood(en)?\b/],
]
/** Words that narrow a target to some items of its slot ("Mage Gloves", "Two Handed Axe"). */
const MATERIALS = ["mage", "light", "warrior", "leather", "cloth", "plate", "metal", "wooden", "scale", "robe", "cape"]
const ATTRIBUTES = ["finesse", "intelligence", "strength", "unique", "vanilla", "bladed", "two handed"]
const WEAPONS = ["knife", "club", "staff", "bow", "crossbow", "axe", "mace", "sword", "spear", "dagger", "wand"]
const QUALIFIERS = [...MATERIALS, ...ATTRIBUTES, ...WEAPONS]
const QUALIFIED = new RegExp(String.raw`\b(${QUALIFIERS.join("|")})\b`, "i")

const withinTags = (item: Item, tags: string[]) =>
  item.tags.some((tag) => tags.some((target) => tagHierarchy.isWithin(tag, target)))
const byName = (items: Item[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, "en"))

/**
 * Resolves the groups a catalog's recipes name ("#Fish", "Pants, Leggings or Sarong") into the items
 * of the catalog they stand for. Every item of the recipes and the game's inventory is a candidate.
 */
export class ItemGroupResolver {
  /** Every item by name, with the categories and tags of all its appearances merged. */
  private readonly items = new Map<string, Item>()
  /** Every group an ingredient or a product names, by name key. */
  private readonly definitions = new Map<string, Item>()

  constructor(recipes: Recipe[], inventory: Item[] = []) {
    for (const item of [...recipes.flatMap((row) => [...row.results(), ...row.ingredients]), ...inventory]) {
      const id = item.nameKey
      if (GroupMatcher.for(item)) this.definitions.set(id, item)
      else if (!item.selectorTag) {
        const previous = this.items.get(id)
        this.items.set(
          id,
          new Item({
            ...previous,
            ...item,
            quantity: undefined,
            craftingCategories: [
              ...new Set([...(previous?.craftingCategories ?? []), ...(item.craftingCategories ?? [])]),
            ],
            tags: [...new Set([...(previous?.tags ?? []), ...item.tags])],
          }),
        )
      }
    }
    for (const id of this.definitions.keys()) if (!this.items.get(id)?.craftingCategories?.length) this.items.delete(id)
  }

  /** The groups with at least `minimumSize` members, by name key. */
  groups(minimumSize = 4): ItemGroups {
    const groups: ItemGroups = {}
    for (const [id, definition] of this.definitions) {
      const matcher = GroupMatcher.for(definition)!
      const members = [...this.items.values()]
        .filter((item) => matcher.matches(item))
        .sort((a, b) => a.name.localeCompare(b.name, "en"))
      if (members.length >= minimumSize) groups[id] = new ItemGroup({ id, name: definition.name, members })
    }
    return groups
  }

  /**
   * The items each upgrade can be applied to, as one group per equipment slot it names: a target such as
   * "Leather Upperbody, Gloves, Boots" becomes "Leather Upperbody", "Leather Gloves" and "Leather Boots".
   * A qualified single target ("Mage Gloves", "#Two-Handed-Axe") uses its own group; a plain slot
   * ("Boots", "#Glove-Armor") means every item of that slot, even ones without game category data.
   */
  upgradeTargets(upgrades: Upgrade[]): Record<string, ItemGroup[]> {
    const candidates = [...this.items.values()].filter(
      (item) => !/,|\bor\b|%|\(|^(boosted|colored|elemental boosted) /i.test(item.name),
    )
    const byUpgrade: Record<string, ItemGroup[]> = {}
    for (const upgrade of upgrades)
      byUpgrade[upgrade.id] = slotGroups(upgrade, candidates) ?? [targetGroup(upgrade, candidates)]
    return byUpgrade
  }
}

/** A target listing several slots: one group per slot, each keeping the target's material. */
function slotGroups(upgrade: Upgrade, candidates: Item[]): ItemGroup[] | undefined {
  const raw = upgrade.target.name.replace(/^#/, "")
  const text = words(raw)
  const material = targetMaterials.find(([prefix]) => prefix.test(text))
  const prefix = material
    ? raw
        .split(/[\s,-]+/)
        .slice(0, material[0].exec(text)![0].split(" ").length)
        .join(" ")
    : ""
  // Selectors join their words with dashes ("Chest-Gloves-Or-Sarong"); names list them with commas.
  const parts = (upgrade.target.selectorTag ? text.slice(words(prefix).length).split(" ") : raw.split(","))
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== "or")
  const bySlot = new Map<string, string[]>()
  for (const part of parts) {
    const tag = slotWords.find(([pattern]) => pattern.test(words(part)))?.[1]
    if (tag && upgrade.targetTags.includes(tag)) bySlot.set(tag, [...(bySlot.get(tag) ?? []), part])
  }
  if (upgrade.targetTags.length <= 1 || bySlot.size <= 1) return undefined
  return [...bySlot].map(([tag, slotParts]) => {
    const slot = slotParts
      .map((part) => part.replace(new RegExp(String.raw`^${prefix}\s+`, "i"), ""))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" or ")
    const name = prefix ? `${prefix} ${slot}` : slot
    const members = candidates.filter(
      (item) =>
        withinTags(item, [tag]) &&
        (!material || material[1].test(`${words(item.name)} ${words((item.craftingCategories ?? []).join(" "))}`)),
    )
    return new ItemGroup({ id: TextKey.item(name), name, members: byName(members) })
  })
}

/** A single target: its own group when qualified, otherwise every item of its slot. */
function targetGroup(upgrade: Upgrade, candidates: Item[]): ItemGroup {
  const qualified = QUALIFIED.test(words(upgrade.target.selectorTag ?? upgrade.target.name))
  const matcher = qualified ? GroupMatcher.for(upgrade.target) : undefined
  let members = matcher
    ? candidates.filter((item) => matcher.matches(item) && withinTags(item, upgrade.targetTags))
    : []
  if (members.length === 0) members = candidates.filter((item) => withinTags(item, upgrade.targetTags))
  return new ItemGroup({ id: upgrade.target.nameKey, name: upgrade.target.name, members: byName(members) })
}
