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

/** Resolve only recognizable groups; ordinary item names never become groups. */
export function groupMatcher(item: RecipeItem): ((candidate: RecipeItem) => boolean) | undefined {
  const listed = item.selectorTag ? gameGroups.get(item.selectorTag) : undefined
  if (listed)
    return (candidate) =>
      !candidate.selectorTag &&
      !listed.fixed.has(itemIconKey(candidate.name)) &&
      (candidate.statsId ? listed.stats.has(candidate.statsId) : listed.names.has(itemIconKey(candidate.name)))
  const raw = item.selectorTag ?? item.name
  const normalized = words(raw.replace(/^#/, ""))
  const explicit = /,|\bOr\b|-Or-/i.test(raw)
  if (!item.selectorTag && (!explicit || /^(add |boost|all stats potion)/i.test(raw) || /[()]/.test(raw)))
    return undefined
  let alternatives = raw
    .replace(/-Or-/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map(words)
    .filter(Boolean)
  const unique = /\bunique\b/.test(normalized)
  const material = /^(cloth|leather|metal|mage|warrior|plate|silver|wooden)\b/.exec(normalized)?.[1]
  if (explicit && alternatives.length === 1) alternatives = normalized.split(/\s+/).filter((w) => w !== "or")
  if (/-Or-/i.test(raw) && !/rune/i.test(raw))
    alternatives = words(raw)
      .split(" ")
      .filter((word) => word !== "or" && word !== material)
  const test = (candidate: RecipeItem, term: string) => {
    const name = words(candidate.name)
    const tags = candidate.tags.map(words)
    if (!/skillbook|scroll/.test(term) && /\b(skillbook|scroll)\b/.test(name)) return false
    if (
      /\b(armor|armour)\b/.test(term) &&
      !/\b(armor|armour|helmet|helm|gloves|boots|pants|torso|shirt|robe|mask|cap|hat|bracers|gauntlets|belt)\b/.test(
        name,
      )
    )
      return false
    if (
      /\b(plate|glass|cup|crate|barrel)\b/.test(term) &&
      /\b(armor|armour|scraps|identifying|scroll|skillbook)\b/.test(name)
    )
      return false
    if (
      ["metal scraps", "long branch", "short stick", "wood chips", "sharp rock", "nails"].includes(term) &&
      name !== term
    )
      return false
    if (/\b(amulets?|rings?)\b/.test(term) && !/\b(amulets?|rings?)\b/.test(name)) return false
    if (/\b(plates?|glass|cups?)\b/.test(term) && !/\b(plates?|glass|cups?|chalice|goblet)\b/.test(name)) return false
    if (
      /\b(gloves|boots|helmet|upperbody|pants)\b/.test(term) &&
      !/\b(gloves|boots|shoes|helmet|helm|hat|cap|mask|upperbody|torso|shirt|robe|pants|leggings|bracers|gauntlets|armor|armour)\b/.test(
        name,
      )
    )
      return false
    const categories = words((candidate.craftingCategories ?? []).join(" "))
    // The game's CuttingTool category covers every dagger, knife, sword and axe plus a few tools.
    if (term === "cutting tool")
      return candidate.craftingCategories?.length
        ? hasWord(categories, "cutting")
        : candidate.tags.some((tag) => ["Daggers", "Swords", "Axes"].some((type) => isTagWithin(tag, type)))
    const categoryTokens = term.split(" ")
    if (categoryTokens.every((token) => hasWord(categories, token))) return true
    if (term.includes("skillbook") && candidate.craftingCategories?.length) return false
    // A blank skillbook teaches nothing, so it never counts as a school's skillbook.
    if (term.includes("skillbook") && /\bblank\b/.test(name)) return false
    if (tags.some((tag) => tag === term || tag.endsWith(` ${term}`))) return true
    if (term === "fish")
      return (
        /\b(fish|herring|salmon|mackerel|carp|plaice|trout|cod)\b/.test(name) &&
        !/\b(pie|pile|skeleton|amulet|ring|bone)\b/.test(name)
      )
    if (term === "essence") return /\bessence\b/.test(name)
    if (term === "armor" || term === "armour") return candidate.tags.some((tag) => isTagWithin(tag, "Armour"))
    if (term === "dye") return /\bdye\b/.test(name) && !/\b(bag|machine)\b/.test(name)
    if (term === "shoes boots") return /\b(shoes|boots)\b/.test(name)
    const tokens = term.split(" ").filter((token) => !["with", "empty", "rune", "socket"].includes(token))
    if (/empty rune socket/.test(term)) return false // socket availability is instance-specific
    return tokens.length > 0 && tokens.every((token) => hasWord(`${name} ${categories}`, token))
  }
  return (candidate) => {
    if (
      candidate.selectorTag ||
      /,|\bOr\b/i.test(candidate.name) ||
      /^(boosted|colored|elemental boosted) /i.test(candidate.name) ||
      /Crafting Special/i.test(candidate.name) ||
      /%|\b(and|except)\b|\(/i.test(candidate.name)
    )
      return false
    const category = item.selectorTag ? words(item.selectorTag).replaceAll(" ", "") : ""
    const materialSlot = materialSlots[category]
    const slot = equipmentSlots[materialSlot?.slot ?? category]
    const name = words(candidate.name)
    const categories = (candidate.craftingCategories ?? []).map((entry) => words(entry).replaceAll(" ", ""))
    if (slot) {
      if (/\b(scroll|skillbook|potion|backpack|amulet|ring)\b/.test(name)) return false
      if (categories.some((category) => ["amulet", "ring", "weapon"].includes(category))) return false
      if (materialSlot) {
        if (categories.includes(category)) return true
        if (!materialSlot.material.test(name)) return false
      }
      if (slot.categories.some((category) => categories.includes(category))) return true
      const knownSlots = Object.values(equipmentSlots).flatMap((entry) => entry.categories)
      if (categories.some((category) => knownSlots.includes(category))) return false
      return slot.names.test(name)
    }
    const weapon = weaponCategories[category]
    if (weapon) {
      if (/\b(scroll|skillbook|potion|arrow|arrowhead|scraps|amulet|ring)\b/.test(name)) return false
      if (categories.includes(category)) return true
      if (!weapon.test(name)) return false
      if (["axe", "club", "sword", "twohandedmaces", "twohandedaxe", "twohandedsword"].includes(category)) {
        const twoHanded = /\b(two handed|2 h|2h|large mallet)\b/.test(name)
        if (twoHanded !== category.startsWith("twohanded")) return false
      }
      return true
    }
    if (/rune/i.test(raw) && /-Or-/i.test(raw)) {
      const name = words(candidate.name)
      return (
        name.includes("rune") &&
        /\b(small|medium|large|giant)\b/.test(name) &&
        /mystical/i.test(raw) === /mystical/i.test(name) &&
        /power/i.test(raw) === /power/i.test(name)
      )
    }
    if (unique && !/unique/i.test(candidate.name + " " + (candidate.craftingCategories ?? []).join(" "))) return false
    if (explicit)
      return alternatives.some((term) =>
        test(candidate, material && !term.startsWith(material) ? `${material} ${term}` : term),
      )
    return test(candidate, normalized)
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
  const within = (item: RecipeItem, tags: string[]) =>
    item.tags.some((tag) => tags.some((target) => isTagWithin(tag, target)))
  const sorted = (items: RecipeItem[]) => items.sort((a, b) => a.name.localeCompare(b.name, "en"))
  const byUpgrade: Record<string, ItemGroup[]> = {}
  for (const upgrade of upgrades) {
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
    if (upgrade.targetTags.length > 1 && bySlot.size > 1) {
      byUpgrade[upgrade.id] = [...bySlot].map(([tag, slotParts]) => {
        const slot = slotParts
          .map((part) => part.replace(new RegExp(String.raw`^${prefix}\s+`, "i"), ""))
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" or ")
        const name = prefix ? `${prefix} ${slot}` : slot
        const members = candidates.filter(
          (item) =>
            within(item, [tag]) &&
            (!material || material[1].test(`${words(item.name)} ${words((item.craftingCategories ?? []).join(" "))}`)),
        )
        return { id: itemIconKey(name), name, members: sorted(members) }
      })
      continue
    }
    const qualified =
      /\b(mage|light|warrior|leather|cloth|plate|metal|wooden|finesse|intelligence|strength|unique|vanilla|bladed|scale|robe|cape|two handed|knife|club|staff|bow|crossbow|axe|mace|sword|spear|dagger|wand)\b/i.test(
        words(upgrade.target.selectorTag ?? upgrade.target.name),
      )
    const matcher = qualified ? groupMatcher(upgrade.target) : undefined
    let members = matcher ? candidates.filter((item) => matcher(item) && within(item, upgrade.targetTags)) : []
    if (members.length === 0) members = candidates.filter((item) => within(item, upgrade.targetTags))
    byUpgrade[upgrade.id] = [
      { id: itemIconKey(upgrade.target.name), name: upgrade.target.name, members: sorted(members) },
    ]
  }
  return byUpgrade
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

/** Expand all small alternatives during data generation, including multiple groups in one recipe. */
export function expandSmallGroups(recipes: RecipeRow[], groups: ItemGroups): RecipeRow[] {
  const expanded = recipes.flatMap((row) => {
    const alternatives = (item: RecipeItem): RecipeItem[] => {
      if (!isItemGroup(item)) return [item]
      const group = groups[itemIconKey(item.name)]
      if (!group || group.members.length === 0 || group.members.length >= 4 || isGameGroup(item.selectorTag))
        return [item]
      return group.members.map((member) => ({ ...member, quantity: item.quantity }))
    }
    const slots = [row.result, ...row.ingredients]
    let variants: RecipeItem[][] = [[]]
    for (const [index, slot] of slots.entries())
      variants = variants.flatMap((variant) =>
        (index === 0 && row.transformsIngredient !== undefined ? [slot] : alternatives(slot)).map((member) => [
          ...variant,
          member,
        ]),
      )
    if (row.transformsIngredient !== undefined) {
      const resultGroup = groups[itemIconKey(row.result.name)]
      if (isItemGroup(row.result) && resultGroup && resultGroup.members.length > 0 && resultGroup.members.length < 4)
        variants = variants.map(([result, ...ingredients]) => {
          const ingredient = ingredients[row.transformsIngredient!]
          return [isItemGroup(ingredient) ? result : { ...ingredient, quantity: result.quantity }, ...ingredients]
        })
    }
    if (variants.length === 1 && variants[0].every((item, index) => item === slots[index])) return [row]
    return variants.map(([result, ...ingredients], index) => ({
      ...row,
      id: index === 0 ? row.id : `${row.id}::variant-${index + 1}`,
      sourceRecipeIds: row.sourceRecipeIds ?? [row.id],
      result,
      ingredients,
    }))
  })
  const itemKey = (item: RecipeItem) => [
    itemDataKey(item),
    item.selectorTag ?? "",
    item.quantity ?? "",
    item.effect?.en ?? "",
  ]
  // A localized catalog page outranks a bare alias. A slug without a numeric suffix breaks remaining ties.
  const itemRank = (item: RecipeItem) => (item.namePl ? 2 : 0) + (item.slug && /-\d+$/.test(item.slug) ? 0 : 1)
  const preferItem = (current: RecipeItem, incoming: RecipeItem): RecipeItem => {
    const chosen = itemRank(incoming) > itemRank(current) ? incoming : current
    const other = chosen === incoming ? current : incoming
    const craftingCategories = [...new Set([...(chosen.craftingCategories ?? []), ...(other.craftingCategories ?? [])])]
    const merged: RecipeItem = { ...chosen, tags: [...new Set([...chosen.tags, ...other.tags])] }
    if (craftingCategories.length) merged.craftingCategories = craftingCategories
    return merged
  }
  const mergeLocalizedItems = (previous: RecipeRow, row: RecipeRow) => {
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
  const key = (row: RecipeRow, includeRemarks = true) =>
    JSON.stringify([
      itemKey(row.result),
      (row.extraResults ?? []).map((item) => JSON.stringify(itemKey(item))).sort(),
      row.ingredients.map((item) => JSON.stringify(itemKey(item))).sort(),
      row.requirements,
      includeRemarks ? row.remarks : null,
      row.transformsIngredient === undefined ? null : [itemKey(row.ingredients[row.transformsIngredient]), row.notes],
    ])
  // Keep an existing concrete recipe when expansion reaches the same combination.
  const concrete = new Map(expanded.filter((row) => !row.sourceRecipeIds).map((row) => [key(row), row]))
  const output: RecipeRow[] = []
  const generated = new Map<string, RecipeRow>()
  for (const row of expanded) {
    if (!row.sourceRecipeIds) {
      output.push(row)
      continue
    }
    const signature = key(row)
    const previous = concrete.get(signature) ?? generated.get(signature)
    if (previous === row) {
      output.push(row)
      continue
    }
    if (previous) {
      const merged = {
        ...previous,
        ...mergeLocalizedItems(previous, row),
        sourceRecipeIds: [...new Set([...(previous.sourceRecipeIds ?? [previous.id]), ...row.sourceRecipeIds])],
        source: [...new Set([previous.source, row.source].filter(Boolean))].join("; "),
        notes: [...new Set([previous.notes, row.notes].filter(Boolean))].join("\n"),
      }
      const index = output.indexOf(previous)
      if (index !== -1) output[index] = merged
      else {
        const pending = expanded.indexOf(previous)
        if (pending !== -1) expanded[pending] = merged
      }
      if (concrete.has(signature)) concrete.set(signature, merged)
      else generated.set(signature, merged)
    } else {
      generated.set(signature, row)
      output.push(row)
    }
  }
  const unique = new Map<string, RecipeRow[]>()
  for (const row of output) {
    const signature = key(row, false)
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
