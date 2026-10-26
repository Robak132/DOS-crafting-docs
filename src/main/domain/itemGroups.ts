import type { RecipeItem, RecipeRow, RecipeUpgrade } from "./recipes"
import { itemDataKey, itemIconKey } from "./itemIcons"
import { recipeResults } from "./recipeResults"
import { isTagWithin } from "./tagTree"
import comboProperties from "../../../data/itemComboProperties.json"

export type ItemGroup = { id: string; name: string; members: RecipeItem[] }
export type ItemGroups = Record<string, ItemGroup>

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
const gameGroups = new Map(
  [
    ...Object.values(comboProperties.properties as Record<string, GameGroup>),
    ...Object.values(comboProperties.objectGroups as Record<string, GameGroup>),
  ].map((group) => [
    group.group,
    {
      stats: new Set(group.stats),
      names: new Set(group.members.map(itemIconKey)),
      fixed: new Set((group.fixed ?? []).map(itemIconKey)),
    },
  ]),
)

/** Game-defined groups stay one group even with few members: the game accepts any member. */
export const isGameGroup = (selector: string | undefined): boolean =>
  selector !== undefined && gameGroups.has(selector.replace(/^#/, ""))

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

/** Terms the game's names alone cannot settle: each with its own test. */
const SPECIAL_TERMS: Record<string, (name: string, candidate: RecipeItem) => boolean> = {
  fish: (name) =>
    /\b(fish|herring|salmon|mackerel|carp|plaice|trout|cod)\b/.test(name) &&
    !/\b(pie|pile|skeleton|amulet|ring|bone)\b/.test(name),
  essence: (name) => /\bessence\b/.test(name),
  armor: (_, candidate) => candidate.tags.some((tag) => isTagWithin(tag, "Armour")),
  armour: (_, candidate) => candidate.tags.some((tag) => isTagWithin(tag, "Armour")),
  dye: (name) => /\bdye\b/.test(name) && !/\b(bag|machine)\b/.test(name),
  "shoes boots": (name) => /\b(shoes|boots)\b/.test(name),
}

/** Whether an item is what one term of a group's name describes. */
function matchesTerm(candidate: RecipeItem, term: string): boolean {
  const name = words(candidate.name)
  if (excludedByTerm(name, term)) return false
  const categories = words((candidate.craftingCategories ?? []).join(" "))
  // The game's CuttingTool category covers every dagger, knife, sword and axe plus a few tools.
  if (term === "cutting tool")
    return candidate.craftingCategories?.length
      ? hasWord(categories, "cutting")
      : candidate.tags.some((tag) => ["Daggers", "Swords", "Axes"].some((type) => isTagWithin(tag, type)))
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
function gameGroupMatcher(listed: { stats: Set<string>; names: Set<string>; fixed: Set<string> }) {
  return (candidate: RecipeItem) =>
    !candidate.selectorTag &&
    !listed.fixed.has(itemIconKey(candidate.name)) &&
    (candidate.statsId ? listed.stats.has(candidate.statsId) : listed.names.has(itemIconKey(candidate.name)))
}

/** Resolve only recognizable groups; ordinary item names never become groups. */
export function groupMatcher(item: RecipeItem): ((candidate: RecipeItem) => boolean) | undefined {
  const listed = item.selectorTag ? gameGroups.get(item.selectorTag) : undefined
  if (listed) return gameGroupMatcher(listed)
  const raw = item.selectorTag ?? item.name
  const normalized = words(raw.replace(/^#/, ""))
  const explicit = /,|\bOr\b|-Or-/i.test(raw)
  if (!item.selectorTag && (!explicit || /^(add |boost|all stats potion)/i.test(raw) || /[()]/.test(raw)))
    return undefined
  const unique = /\bunique\b/.test(normalized)
  const material = /^(cloth|leather|metal|mage|warrior|plate|silver|wooden)\b/.exec(normalized)?.[1]
  const alternatives = groupTerms(raw, normalized, explicit, material)
  const category = item.selectorTag ? words(item.selectorTag).replaceAll(" ", "") : ""
  const runes = /rune/i.test(raw) && /-Or-/i.test(raw)
  return (candidate) => {
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

export function isItemGroup(item: RecipeItem): boolean {
  return Boolean(item.groupId || groupMatcher(item))
}

export function buildItemGroups(recipes: RecipeRow[], minimumSize = 4, inventory: RecipeItem[] = []): ItemGroups {
  const { all, definitions } = collectItems(recipes, inventory)
  const groups: ItemGroups = {}
  for (const [id, definition] of definitions) {
    const match = groupMatcher(definition)!
    const members = [...all.values()].filter(match).sort((a, b) => a.name.localeCompare(b.name, "en"))
    if (members.length >= minimumSize) groups[id] = { id, name: definition.name, members }
  }
  return groups
}

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

/**
 * The items each upgrade can be applied to, as one group per equipment slot it names: a target such as
 * "Leather Upperbody, Gloves, Boots" becomes "Leather Upperbody", "Leather Gloves" and "Leather Boots".
 * A qualified single target ("Mage Gloves", "#Two-Handed-Axe") uses its own group; a plain slot
 * ("Boots", "#Glove-Armor") means every item of that slot, even ones without game category data.
 */
export function upgradeTargetGroups(
  upgrades: RecipeUpgrade[],
  recipes: RecipeRow[],
  inventory: RecipeItem[] = [],
): Record<string, ItemGroup[]> {
  const { all } = collectItems(recipes, inventory)
  const candidates = [...all.values()].filter(
    (item) => !/,|\bor\b|%|\(|^(boosted|colored|elemental boosted) /i.test(item.name),
  )
  const byUpgrade: Record<string, ItemGroup[]> = {}
  for (const upgrade of upgrades) {
    byUpgrade[upgrade.id] = slotGroups(upgrade, candidates) ?? [targetGroup(upgrade, candidates)]
  }
  return byUpgrade
}

const withinTags = (item: RecipeItem, tags: string[]) =>
  item.tags.some((tag) => tags.some((target) => isTagWithin(tag, target)))
const byName = (items: RecipeItem[]) => [...items].sort((a, b) => a.name.localeCompare(b.name, "en"))

/** A target listing several slots: one group per slot, each keeping the target's material. */
function slotGroups(upgrade: RecipeUpgrade, candidates: RecipeItem[]): ItemGroup[] | undefined {
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
    return { id: itemIconKey(name), name, members: byName(members) }
  })
}

/** Words that narrow a target to some items of its slot ("Mage Gloves", "Two Handed Axe"). */
const QUALIFIERS = [
  ...["mage", "light", "warrior", "leather", "cloth", "plate", "metal", "wooden", "scale", "robe", "cape"],
  ...["finesse", "intelligence", "strength", "unique", "vanilla", "bladed", "two handed"],
  ...["knife", "club", "staff", "bow", "crossbow", "axe", "mace", "sword", "spear", "dagger", "wand"],
]
const QUALIFIED = new RegExp(String.raw`\b(${QUALIFIERS.join("|")})\b`, "i")

/** A single target: its own group when qualified, otherwise every item of its slot. */
function targetGroup(upgrade: RecipeUpgrade, candidates: RecipeItem[]): ItemGroup {
  const qualified = QUALIFIED.test(words(upgrade.target.selectorTag ?? upgrade.target.name))
  const matcher = qualified ? groupMatcher(upgrade.target) : undefined
  let members = matcher ? candidates.filter((item) => matcher(item) && withinTags(item, upgrade.targetTags)) : []
  if (members.length === 0) members = candidates.filter((item) => withinTags(item, upgrade.targetTags))
  return { id: itemIconKey(upgrade.target.name), name: upgrade.target.name, members: byName(members) }
}

function collectItems(recipes: RecipeRow[], inventory: RecipeItem[]) {
  const all = new Map<string, RecipeItem>()
  const definitions = new Map<string, RecipeItem>()
  for (const item of [...recipes.flatMap((row) => [...recipeResults(row), ...row.ingredients]), ...inventory]) {
    const id = itemIconKey(item.name)
    if (groupMatcher(item)) definitions.set(id, item)
    else if (!item.selectorTag) {
      const previous = all.get(id)
      all.set(id, {
        ...previous,
        ...item,
        quantity: undefined,
        craftingCategories: [...new Set([...(previous?.craftingCategories ?? []), ...(item.craftingCategories ?? [])])],
        tags: [...new Set([...(previous?.tags ?? []), ...item.tags])],
      })
    }
  }
  for (const id of definitions.keys()) if (!all.get(id)?.craftingCategories?.length) all.delete(id)
  return { all, definitions }
}

/** Include ingredients without a crafting recipe when searching a group. */
export function groupItemRows(recipes: RecipeRow[], group: ItemGroup): RecipeRow[] {
  return group.members.flatMap((item) => {
    const matches = recipes.filter(
      (row) => !isItemGroup(row.result) && itemIconKey(row.result.name) === itemIconKey(item.name),
    )
    return matches.length
      ? matches
      : [
          {
            id: `group:${group.id}:${itemIconKey(item.name)}`,
            result: item,
            ingredients: [],
            tags: item.tags,
            requirements: "",
            notes: "",
            remarks: "",
            source: "",
          },
        ]
  })
}

/** The members a small group stands for in a recipe slot; anything else stays itself. */
function smallGroupMembers(item: RecipeItem, groups: ItemGroups): RecipeItem[] {
  if (!isItemGroup(item)) return [item]
  const group = groups[itemIconKey(item.name)]
  if (!group || group.members.length === 0 || group.members.length >= 4 || isGameGroup(item.selectorTag)) return [item]
  return group.members.map((member) => ({ ...member, quantity: item.quantity }))
}

/** One recipe per combination of the small groups it uses. */
function expandRow(row: RecipeRow, groups: ItemGroups): RecipeRow[] {
  const slots = [row.result, ...row.ingredients]
  const transforms = row.transformsIngredient
  let variants: RecipeItem[][] = [[]]
  for (const [index, slot] of slots.entries()) {
    const members = index === 0 && transforms !== undefined ? [slot] : smallGroupMembers(slot, groups)
    variants = variants.flatMap((variant) => members.map((member) => [...variant, member]))
  }
  const resultGroup = groups[itemIconKey(row.result.name)]
  const smallResult =
    isItemGroup(row.result) && resultGroup && resultGroup.members.length > 0 && resultGroup.members.length < 4
  if (transforms !== undefined && smallResult)
    variants = variants.map(([result, ...ingredients]) => {
      const ingredient = ingredients[transforms]
      return [isItemGroup(ingredient) ? result : { ...ingredient, quantity: result.quantity }, ...ingredients]
    })
  if (variants.length === 1 && variants[0].every((item, index) => item === slots[index])) return [row]
  return variants.map(([result, ...ingredients], index) => ({
    ...row,
    id: index === 0 ? row.id : `${row.id}::variant-${index + 1}`,
    sourceRecipeIds: row.sourceRecipeIds ?? [row.id],
    result,
    ingredients,
  }))
}

const itemKey = (item: RecipeItem) => [
  itemDataKey(item),
  item.selectorTag ?? "",
  item.quantity ?? "",
  item.effect?.en ?? "",
]
/** A total order: collation first, code units to separate strings it treats as equal. */
const compareText = (a: string, b: string) => a.localeCompare(b, "en") || Number(a > b) - Number(a < b)

/** A localized catalog page outranks a bare alias. A slug without a numeric suffix breaks remaining ties. */
const itemRank = (item: RecipeItem) => (item.namePl ? 2 : 0) + (item.slug && /-\d+$/.test(item.slug) ? 0 : 1)

function preferItem(current: RecipeItem, incoming: RecipeItem): RecipeItem {
  const chosen = itemRank(incoming) > itemRank(current) ? incoming : current
  const other = chosen === incoming ? current : incoming
  const craftingCategories = [...new Set([...(chosen.craftingCategories ?? []), ...(other.craftingCategories ?? [])])]
  const merged: RecipeItem = { ...chosen, tags: [...new Set([...chosen.tags, ...other.tags])] }
  if (craftingCategories.length) merged.craftingCategories = craftingCategories
  return merged
}

function mergeLocalizedItems(previous: RecipeRow, row: RecipeRow) {
  const pool = [...row.ingredients]
  return {
    result: preferItem(previous.result, row.result),
    ingredients: previous.ingredients.map((item) => {
      const matchIndex = pool.findIndex(
        (candidate) => JSON.stringify(itemKey(candidate)) === JSON.stringify(itemKey(item)),
      )
      if (matchIndex === -1) return item
      const [match] = pool.splice(matchIndex, 1)
      return preferItem(item, match)
    }),
  }
}

/** Recipes with the same key are the same craft. */
const recipeKey = (row: RecipeRow, includeRemarks = true) =>
  JSON.stringify([
    itemKey(row.result),
    (row.extraResults ?? []).map((item) => JSON.stringify(itemKey(item))).sort(compareText),
    row.ingredients.map((item) => JSON.stringify(itemKey(item))).sort(compareText),
    row.requirements,
    includeRemarks ? row.remarks : null,
    row.transformsIngredient === undefined ? null : [itemKey(row.ingredients[row.transformsIngredient]), row.notes],
  ])

/** Generated recipes that repeat another craft are merged into it; an existing concrete recipe wins. */
function mergeGeneratedRow(previous: RecipeRow, row: RecipeRow): RecipeRow {
  return {
    ...previous,
    ...mergeLocalizedItems(previous, row),
    sourceRecipeIds: [...new Set([...(previous.sourceRecipeIds ?? [previous.id]), ...(row.sourceRecipeIds ?? [])])],
    source: [...new Set([previous.source, row.source].filter(Boolean))].join("; "),
    notes: [...new Set([previous.notes, row.notes].filter(Boolean))].join("\n"),
  }
}
/** Puts `next` where `previous` is in `rows`; false when it is not there. */
function replaceRow(rows: RecipeRow[], previous: RecipeRow, next: RecipeRow): boolean {
  const index = rows.indexOf(previous)
  if (index !== -1) rows[index] = next
  return index !== -1
}
function mergeGenerated(expanded: RecipeRow[]): RecipeRow[] {
  const concrete = new Map(expanded.filter((row) => !row.sourceRecipeIds).map((row) => [recipeKey(row), row]))
  const output: RecipeRow[] = []
  const generated = new Map<string, RecipeRow>()
  for (const row of expanded) {
    const signature = row.sourceRecipeIds ? recipeKey(row) : ""
    const previous = row.sourceRecipeIds ? (concrete.get(signature) ?? generated.get(signature)) : row
    if (previous === row || !previous) {
      if (row.sourceRecipeIds && !previous) generated.set(signature, row)
      output.push(row)
      continue
    }
    const merged = mergeGeneratedRow(previous, row)
    replaceRow(output, previous, merged) || replaceRow(expanded, previous, merged)
    if (concrete.has(signature)) concrete.set(signature, merged)
    else generated.set(signature, merged)
  }
  return output
}

/** Recipes that differ only in remarks (or where one has none) become one. */
function mergeRemarkVariants(rows: RecipeRow[]): RecipeRow[] {
  const unique = new Map<string, RecipeRow[]>()
  for (const row of rows) {
    const signature = recipeKey(row, false)
    const variants = unique.get(signature) ?? []
    const index = variants.findIndex(
      (previous) => !previous.remarks || !row.remarks || previous.remarks === row.remarks,
    )
    if (index === -1) {
      variants.push(row)
      unique.set(signature, variants)
      continue
    }
    const previous = variants[index]
    variants[index] = {
      ...previous,
      ...mergeLocalizedItems(previous, row),
      remarks: previous.remarks || row.remarks,
      tags: [...new Set([...previous.tags, ...row.tags])],
      sourceRecipeIds: [
        ...new Set([...(previous.sourceRecipeIds ?? [previous.id]), ...(row.sourceRecipeIds ?? [row.id])]),
      ],
      source: [...new Set([...previous.source.split("; "), ...row.source.split("; ")].filter(Boolean))].join("; "),
      notes: [...new Set([...previous.notes.split("\n"), ...row.notes.split("\n")].filter(Boolean))].join("\n"),
    }
  }
  return [...unique.values()].flat()
}

/** Expand all small alternatives during data generation, including multiple groups in one recipe. */
export function expandSmallGroups(recipes: RecipeRow[], groups: ItemGroups): RecipeRow[] {
  return mergeRemarkVariants(mergeGenerated(recipes.flatMap((row) => expandRow(row, groups))))
}
