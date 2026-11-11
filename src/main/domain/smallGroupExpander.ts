import { GroupMatcher } from "./groupMatcher"
import type { Item } from "./item"
import type { ItemGroups } from "./itemGroup"
import type { Recipe } from "./recipe"

const itemKey = (item: Item) => [item.resourceKey, item.selectorTag ?? "", item.quantity ?? "", item.effect?.en ?? ""]
/** A total order: collation first, code units to separate strings it treats as equal. */
const compareText = (a: string, b: string) => a.localeCompare(b, "en") || Number(a > b) - Number(a < b)

/** A localized catalog page outranks a bare alias. A slug without a numeric suffix breaks remaining ties. */
const itemRank = (item: Item) => (item.namePl ? 2 : 0) + (item.slug && /-\d+$/.test(item.slug) ? 0 : 1)

/** The better described of two copies of one item, with the categories and tags of both. */
function preferItem(current: Item, incoming: Item): Item {
  const chosen = itemRank(incoming) > itemRank(current) ? incoming : current
  const other = chosen === incoming ? current : incoming
  const craftingCategories = [...new Set([...(chosen.craftingCategories ?? []), ...(other.craftingCategories ?? [])])]
  const merged = chosen.with({ tags: [...new Set([...chosen.tags, ...other.tags])] })
  if (craftingCategories.length) merged.craftingCategories = craftingCategories
  return merged
}

function mergeLocalizedItems(previous: Recipe, row: Recipe) {
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
const recipeKey = (row: Recipe, includeRemarks = true) =>
  JSON.stringify([
    itemKey(row.result),
    (row.extraResults ?? []).map((item) => JSON.stringify(itemKey(item))).sort(compareText),
    row.ingredients.map((item) => JSON.stringify(itemKey(item))).sort(compareText),
    row.requirements,
    includeRemarks ? row.remarks : null,
    row.transformsIngredient === undefined ? null : [itemKey(row.ingredients[row.transformsIngredient]), row.notes],
  ])

/** The Polish book names of two merged rows; a row without them reads its English source. */
function mergeSourcePl(previous: Recipe, row: Recipe): { sourcePl?: string } {
  if (!previous.sourcePl && !row.sourcePl) return {}
  const names = [previous, row].flatMap((entry) => (entry.sourcePl ?? entry.source).split("; ")).filter(Boolean)
  return { sourcePl: [...new Set(names)].join("; ") }
}

/** Generated recipes that repeat another craft are merged into it; an existing concrete recipe wins. */
function mergeGeneratedRow(previous: Recipe, row: Recipe): Recipe {
  return previous.with({
    ...mergeLocalizedItems(previous, row),
    sourceRecipeIds: [...new Set([...(previous.sourceRecipeIds ?? [previous.id]), ...(row.sourceRecipeIds ?? [])])],
    source: [...new Set([previous.source, row.source].filter(Boolean))].join("; "),
    ...mergeSourcePl(previous, row),
    notes: [...new Set([previous.notes, row.notes].filter(Boolean))].join("\n"),
  })
}

/** Puts `next` where `previous` is in `rows`; false when it is not there. */
function replaceRow(rows: Recipe[], previous: Recipe, next: Recipe): boolean {
  const index = rows.indexOf(previous)
  if (index !== -1) rows[index] = next
  return index !== -1
}

function mergeGenerated(expanded: Recipe[]): Recipe[] {
  const concrete = new Map(expanded.filter((row) => !row.sourceRecipeIds).map((row) => [recipeKey(row), row]))
  const output: Recipe[] = []
  const generated = new Map<string, Recipe>()
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
function mergeRemarkVariants(rows: Recipe[]): Recipe[] {
  const unique = new Map<string, Recipe[]>()
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
    variants[index] = previous.with({
      ...mergeLocalizedItems(previous, row),
      remarks: previous.remarks || row.remarks,
      tags: [...new Set([...previous.tags, ...row.tags])],
      sourceRecipeIds: [
        ...new Set([...(previous.sourceRecipeIds ?? [previous.id]), ...(row.sourceRecipeIds ?? [row.id])]),
      ],
      source: [...new Set([...previous.source.split("; "), ...row.source.split("; ")].filter(Boolean))].join("; "),
      ...mergeSourcePl(previous, row),
      notes: [...new Set([...previous.notes.split("\n"), ...row.notes.split("\n")].filter(Boolean))].join("\n"),
    })
  }
  return [...unique.values()].flat()
}

/**
 * Small groups (fewer than four members) are not worth a group link: each recipe using one becomes one
 * recipe per member, and recipes that then repeat each other are merged. Runs during data generation.
 */
export class SmallGroupExpander {
  constructor(private readonly groups: ItemGroups) {}

  /** Every recipe with its small groups expanded, including several groups in one recipe. */
  expand(recipes: Recipe[]): Recipe[] {
    return mergeRemarkVariants(mergeGenerated(recipes.flatMap((row) => this.expandRow(row))))
  }

  /** The resolved small group an item names, if any. */
  private smallGroup(item: Item) {
    const group = this.groups[item.nameKey]
    return group && group.members.length > 0 && group.members.length < 4 ? group : undefined
  }

  /** The members a small group stands for in a recipe slot; anything else stays itself. */
  private members(item: Item): Item[] {
    if (!item.isGroup()) return [item]
    const group = this.smallGroup(item)
    if (!group || GroupMatcher.isGameGroup(item.selectorTag)) return [item]
    return group.members.map((member) => member.with({ quantity: item.quantity }))
  }

  /** One recipe per combination of the small groups it uses. */
  private expandRow(row: Recipe): Recipe[] {
    const slots = [row.result, ...row.ingredients]
    const transforms = row.transformsIngredient
    let variants: Item[][] = [[]]
    for (const [index, slot] of slots.entries()) {
      const members = index === 0 && transforms !== undefined ? [slot] : this.members(slot)
      variants = variants.flatMap((variant) => members.map((member) => [...variant, member]))
    }
    if (transforms !== undefined && row.result.isGroup() && this.smallGroup(row.result))
      variants = variants.map(([result, ...ingredients]) => {
        const ingredient = ingredients[transforms]
        return [ingredient.isGroup() ? result : ingredient.with({ quantity: result.quantity }), ...ingredients]
      })
    if (variants.length === 1 && variants[0].every((item, index) => item === slots[index])) return [row]
    return variants.map(([result, ...ingredients], index) =>
      row.with({
        id: index === 0 ? row.id : `${row.id}::variant-${index + 1}`,
        sourceRecipeIds: row.sourceRecipeIds ?? [row.id],
        result,
        ingredients,
      }),
    )
  }
}
