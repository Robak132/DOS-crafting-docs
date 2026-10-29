import type { Item } from "./item"
import { tagHierarchy } from "./tagHierarchy"
import { TextKey } from "./textKey"
import comboProperties from "../../../data/itemComboProperties.json"

const words = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
const aliases: Record<string, string[]> = {
  chest: ["upperbody", "torso", "shirt", "chest", "breast"],
  upperbody: ["upperbody", "torso", "shirt", "breast"],
  lowerbody: ["pants", "leggings", "sarong"],
  gloves: ["gloves", "bracers", "gauntlets"],
  boots: ["boots", "shoes"],
  helmet: ["helmet", "helm", "cap", "hat"],
  cloth: ["cloth", "robe", "mage"],
}
function hasWord(value: string, token: string): boolean {
  return (aliases[token] ?? [token]).some((word) =>
    value.split(" ").some((token) => token === word || token === `${word}s` || `${token}s` === word),
  )
}

// ItemCombination Category values describe slots, including transformed results.
const equipmentSlots: Record<string, { categories: string[]; names: RegExp }> = {
  upperbody: {
    categories: ["upperbody", "breast"],
    names: /\b(upperbody|torso|shirt|robe|breastplate)\b|\bbody (armor|armour)\b/,
  },
  armorshoes: { categories: ["armorshoes", "boots"], names: /\b(boots|shoes)\b/ },
  cape: { categories: ["cape", "cloak"], names: /\b(cape|cloak)\b/ },
  gloves: { categories: ["gloves"], names: /\b(gloves|bracers|gauntlets)\b/ },
  helmet: { categories: ["helmet"], names: /\b(helmet|helm|hat|cap|mask)\b/ },
  pants: { categories: ["pants", "leggings", "lowerbody"], names: /\b(pants|leggings|lowerbody|sarong)\b/ },
}

const materialSlots: Record<string, { slot: string; material: RegExp }> = {
  armorleather: { slot: "upperbody", material: /\b(leather|light|ranger|rogue|shadow)\b/ },
  robearmor: {
    slot: "upperbody",
    material:
      /\b(mage|cloth|robe|aerotheurge|geomancer|hydrosophist|necromancer|polymorph|pyrokinetic|summoning|summoner)\b/,
  },
  armorscale: { slot: "upperbody", material: /\b(warrior|metal|plate|scale|scalemail)\b/ },
}
for (const [material, pattern] of Object.entries({
  Leather: /\b(leather|light|ranger|rogue|shadow)\b/,
  Mage: /\b(mage|cloth|aerotheurge|geomancer|hydrosophist|necromancer|polymorph|pyrokinetic|summoning|summoner)\b/,
  Scale: /\b(warrior|metal|plate|scale|scalemail)\b/,
}))
  for (const [prefix, slot] of Object.entries({
    Boots: "armorshoes",
    Gloves: "gloves",
    Helmet: "helmet",
    Pants: "pants",
  }))
    materialSlots[(prefix + material).toLowerCase()] = { slot, material: pattern }

const weaponCategories: Record<string, RegExp> = {
  axe: /\baxe\b/,
  club: /\b(mace|club|mallet)\b/,
  sword: /\bsword\b/,
  twohandedmaces: /\b(mace|club|mallet)\b/,
  twohandedaxe: /\baxe\b/,
  twohandedsword: /\bsword\b/,
  bow: /\bbow\b/,
  crossbow: /\b(crossbow|arbalest)\b/,
  knife: /\bknife\b/,
  staff: /\bstaff\b/,
  armorbelt: /\bbelt\b/,
}

type GameGroup = { group: string; members: string[]; stats: string[]; fixed?: string[] }
type ListedGroup = { stats: Set<string>; names: Set<string>; fixed: Set<string> }
const gameGroups = new Map<string, ListedGroup>(
  [
    ...Object.values(comboProperties.properties as Record<string, GameGroup>),
    ...Object.values(comboProperties.objectGroups as Record<string, GameGroup>),
  ].map((group) => [
    group.group,
    {
      stats: new Set(group.stats),
      names: new Set(group.members.map(TextKey.item)),
      fixed: new Set((group.fixed ?? []).map(TextKey.item)),
    },
  ]),
)

const ARMOUR_NAME =
  /\b(armor|armour|helmet|helm|gloves|boots|pants|torso|shirt|robe|mask|cap|hat|bracers|gauntlets|belt)\b/
const SLOT_NAME =
  /\b(gloves|boots|shoes|helmet|helm|hat|cap|mask|upperbody|torso|shirt|robe|pants|leggings|bracers|gauntlets|armor|armour)\b/
const EXACT_TERMS = new Set(["metal scraps", "long branch", "short stick", "wood chips", "sharp rock", "nails"])

/** Names a term must not match: an item of another kind that merely shares a word with it. */
function excludedByTerm(name: string, term: string): boolean {
  if (!/skillbook|scroll/.test(term) && /\b(skillbook|scroll)\b/.test(name)) return true
  if (/\b(armor|armour)\b/.test(term) && !ARMOUR_NAME.test(name)) return true
  if (
    /\b(plate|glass|cup|crate|barrel)\b/.test(term) &&
    /\b(armor|armour|scraps|identifying|scroll|skillbook)\b/.test(name)
  )
    return true
  if (EXACT_TERMS.has(term) && name !== term) return true
  if (/\b(amulets?|rings?)\b/.test(term) && !/\b(amulets?|rings?)\b/.test(name)) return true
  if (/\b(plates?|glass|cups?)\b/.test(term) && !/\b(plates?|glass|cups?|chalice|goblet)\b/.test(name)) return true
  return /\b(gloves|boots|helmet|upperbody|pants)\b/.test(term) && !SLOT_NAME.test(name)
}

const isArmour = (candidate: Item) => candidate.tags.some((tag) => tagHierarchy.isWithin(tag, "Armour"))
/** Terms the game's names alone cannot settle: each with its own test. */
const SPECIAL_TERMS: Record<string, (name: string, candidate: Item) => boolean> = {
  fish: (name) =>
    /\b(fish|herring|salmon|mackerel|carp|plaice|trout|cod)\b/.test(name) &&
    !/\b(pie|pile|skeleton|amulet|ring|bone)\b/.test(name),
  essence: (name) => /\bessence\b/.test(name),
  armor: (_, candidate) => isArmour(candidate),
  armour: (_, candidate) => isArmour(candidate),
  dye: (name) => /\bdye\b/.test(name) && !/\b(bag|machine)\b/.test(name),
  "shoes boots": (name) => /\b(shoes|boots)\b/.test(name),
}

/** Whether an item is what one term of a group's name describes. */
function matchesTerm(candidate: Item, term: string): boolean {
  const name = words(candidate.name)
  if (excludedByTerm(name, term)) return false
  const categories = words((candidate.craftingCategories ?? []).join(" "))
  // The game's CuttingTool category covers every dagger, knife, sword and axe plus a few tools.
  if (term === "cutting tool")
    return candidate.craftingCategories?.length
      ? hasWord(categories, "cutting")
      : candidate.tags.some((tag) => ["Daggers", "Swords", "Axes"].some((type) => tagHierarchy.isWithin(tag, type)))
  if (term.split(" ").every((token) => hasWord(categories, token))) return true
  if (term.includes("skillbook") && candidate.craftingCategories?.length) return false
  // A blank skillbook teaches nothing, so it never counts as a school's skillbook.
  if (term.includes("skillbook") && /\bblank\b/.test(name)) return false
  if (candidate.tags.map(words).some((tag) => tag === term || tag.endsWith(` ${term}`))) return true
  const special = SPECIAL_TERMS[term]
  if (special) return special(name, candidate)
  if (/empty rune socket/.test(term)) return false // socket availability is instance-specific
  const tokens = term.split(" ").filter((token) => !["with", "empty", "rune", "socket"].includes(token))
  return tokens.length > 0 && tokens.every((token) => hasWord(`${name} ${categories}`, token))
}

/** Names that are lists, upgrades or descriptions rather than one item. */
const notAnItem = (name: string) =>
  /,|\bOr\b/i.test(name) ||
  /^(boosted|colored|elemental boosted) /i.test(name) ||
  /Crafting Special/i.test(name) ||
  /%|\b(and|except)\b|\(/i.test(name)

const BOTH_HANDED = new Set(["axe", "club", "sword", "twohandedmaces", "twohandedaxe", "twohandedsword"])

/** A selector naming an equipment slot (with or without a material); undefined when it names none. */
function matchesSlot(category: string, name: string, categories: string[]): boolean | undefined {
  const materialSlot = materialSlots[category]
  const slot = equipmentSlots[materialSlot?.slot ?? category]
  if (!slot) return undefined
  if (/\b(scroll|skillbook|potion|backpack|amulet|ring)\b/.test(name)) return false
  if (categories.some((entry) => ["amulet", "ring", "weapon"].includes(entry))) return false
  if (materialSlot && categories.includes(category)) return true
  if (materialSlot && !materialSlot.material.test(name)) return false
  if (slot.categories.some((entry) => categories.includes(entry))) return true
  const knownSlots = Object.values(equipmentSlots).flatMap((entry) => entry.categories)
  if (categories.some((entry) => knownSlots.includes(entry))) return false
  return slot.names.test(name)
}

/** A selector naming a weapon category; undefined when it names none. */
function matchesWeapon(category: string, name: string, categories: string[]): boolean | undefined {
  const weapon = weaponCategories[category]
  if (!weapon) return undefined
  if (/\b(scroll|skillbook|potion|arrow|arrowhead|scraps|amulet|ring)\b/.test(name)) return false
  if (categories.includes(category)) return true
  if (!weapon.test(name)) return false
  if (!BOTH_HANDED.has(category)) return true
  const twoHanded = /\b(two handed|2 h|2h|large mallet)\b/.test(name)
  return twoHanded === category.startsWith("twohanded")
}

/** "Small-Or-Medium-Or-…-Rune": a rune of any size, mystical and powered as the selector says. */
const matchesRune = (raw: string, name: string) =>
  name.includes("rune") &&
  /\b(small|medium|large|giant)\b/.test(name) &&
  /mystical/i.test(raw) === /mystical/i.test(name) &&
  /power/i.test(raw) === /power/i.test(name)

/** The alternatives a group's name lists ("A, B or C"), qualified by a shared material. */
function groupTerms(raw: string, normalized: string, explicit: boolean, material: string | undefined): string[] {
  let alternatives = raw
    .replace(/-Or-/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map(words)
    .filter(Boolean)
  if (explicit && alternatives.length === 1) alternatives = normalized.split(/\s+/).filter((w) => w !== "or")
  if (/-Or-/i.test(raw) && !/rune/i.test(raw))
    alternatives = words(raw)
      .split(" ")
      .filter((word) => word !== "or" && word !== material)
  return alternatives
}

/** A game-defined group: its members by Stats ID (by name for items without one), never its fixed scenery. */
function gameGroupTest(listed: ListedGroup) {
  return (candidate: Item) =>
    !candidate.selectorTag &&
    !listed.fixed.has(candidate.nameKey) &&
    (candidate.statsId ? listed.stats.has(candidate.statsId) : listed.names.has(candidate.nameKey))
}

/** The test of a group named by a selector or by a list of alternatives ("A, B or C"). */
function namedGroupTest(item: Item, raw: string, explicit: boolean) {
  const normalized = words(raw.replace(/^#/, ""))
  const unique = /\bunique\b/.test(normalized)
  const material = /^(cloth|leather|metal|mage|warrior|plate|silver|wooden)\b/.exec(normalized)?.[1]
  const alternatives = groupTerms(raw, normalized, explicit, material)
  const category = item.selectorTag ? words(item.selectorTag).replaceAll(" ", "") : ""
  const runes = /rune/i.test(raw) && /-Or-/i.test(raw)
  return (candidate: Item) => {
    if (candidate.selectorTag || notAnItem(candidate.name)) return false
    const name = words(candidate.name)
    const categories = (candidate.craftingCategories ?? []).map((entry) => words(entry).replaceAll(" ", ""))
    const bySelector = matchesSlot(category, name, categories) ?? matchesWeapon(category, name, categories)
    if (bySelector !== undefined) return bySelector
    if (runes) return matchesRune(raw, name)
    if (unique && !/unique/i.test(candidate.name + " " + (candidate.craftingCategories ?? []).join(" "))) return false
    if (!explicit) return matchesTerm(candidate, normalized)
    return alternatives.some((term) =>
      matchesTerm(candidate, material && !term.startsWith(material) ? `${material} ${term}` : term),
    )
  }
}

/**
 * The items an ingredient group stands for: a selector ("#Fish"), a game-defined group or a list of
 * alternatives ("Pants, Leggings or Sarong"). Ordinary item names never become groups.
 */
export class GroupMatcher {
  private constructor(private readonly test: (candidate: Item) => boolean) {}

  /** The matcher of a recognizable group; undefined for an ordinary item. */
  static for(item: Item): GroupMatcher | undefined {
    const listed = item.selectorTag ? gameGroups.get(item.selectorTag) : undefined
    if (listed) return new GroupMatcher(gameGroupTest(listed))
    const raw = item.selectorTag ?? item.name
    const explicit = /,|\bOr\b|-Or-/i.test(raw)
    if (!item.selectorTag && (!explicit || /^(add |boost|all stats potion)/i.test(raw) || /[()]/.test(raw)))
      return undefined
    return new GroupMatcher(namedGroupTest(item, raw, explicit))
  }

  /** Game-defined groups stay one group even with few members: the game accepts any member. */
  static isGameGroup(selector: string | undefined): boolean {
    return selector !== undefined && gameGroups.has(selector.replace(/^#/, ""))
  }

  matches(candidate: Item): boolean {
    return this.test(candidate)
  }
}
