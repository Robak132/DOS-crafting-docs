import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import type { Catalog } from "../src/main/domain/catalog"
import { CatalogBuilder } from "../src/main/domain/catalogBuilder"
import { CraftRoles } from "../src/main/domain/craftRoles"
import type { Game } from "../src/main/domain/game"
import { GroupMatcher } from "../src/main/domain/groupMatcher"
import { IconAtlas, type ItemIconMap } from "../src/main/domain/iconAtlas"
import { Item } from "../src/main/domain/item"
import { ItemGroup, type ItemGroups } from "../src/main/domain/itemGroup"
import { ItemGroupResolver } from "../src/main/domain/itemGroupResolver"
import { ItemList } from "../src/main/domain/itemList"
import { CatalogLocalizer, NameDictionary } from "../src/main/domain/localisation"
import type { Recipe } from "../src/main/domain/recipe"
import { TextKey } from "../src/main/domain/textKey"
import type { Upgrade } from "../src/main/domain/upgrade"
import { RecipeStats } from "../src/main/domain/recipeStats"
import { SmallGroupExpander } from "../src/main/domain/smallGroupExpander"
import { TagSidebar } from "../src/main/domain/tagSidebar"
import type { CatalogManifest, PageSummary } from "../src/main/domain/types"
import { loadLibrary } from "./load-library"

type Localised = Record<string, { en: string; pl?: string }> | undefined
/**
 * Names readers see for the items upgrades apply to, by the name generation gives them: the library's target
 * or slot, shown without "#" and dashes, or for targets joined from several the names joined with "; ".
 */
type TargetNames = Record<string, { en: string; pl?: string }>
type Effects = Record<string, { en?: string; pl?: string; recipes?: Record<string, { en: string; pl?: string }> }>

/** Writes `<outputDirectory>/data`; the build passes `dist`, so the catalog data lands next to the app. */
export async function generateData(outputDirectory = "dist") {
  const started = performance.now()
  NameDictionary.reset()
  // Validate source JSON before replacing the previously generated output.
  const library = await loadLibrary()
  const labels: Record<string, string> = JSON.parse(await fs.readFile("data/tagLabels.json", "utf8"))
  const catalogs = new CatalogBuilder(library.sources, labels, library.upgrades).build()
  const descriptions = JSON.parse(await fs.readFile("data/itemDescriptions.json", "utf8"))
  const tagLocalisation = JSON.parse(await fs.readFile("data/tagLocalisation.json", "utf8"))
  const effects = JSON.parse(await fs.readFile("data/itemEffects.json", "utf8"))
  const icons: ItemIconMap = JSON.parse(await fs.readFile("data/itemIcons.json", "utf8"))
  const rarity: Record<string, { unique: string[] }> = JSON.parse(await fs.readFile("data/itemRarity.json", "utf8"))
  const targetNames: TargetNames = JSON.parse(await fs.readFile("data/upgradeTargetNames.json", "utf8"))
  await fs.rm(path.join(outputDirectory, "data"), { recursive: true, force: true })
  await fs.mkdir(path.join(outputDirectory, "data"), { recursive: true })
  await fs.cp("assets/item-icons", path.join(outputDirectory, "data/icons"), { recursive: true })
  const writes: Promise<void>[] = []
  for (const game of Object.keys(catalogs) as Game[]) {
    const data = catalogs[game]
    // Catalogs share base recipes; each mode resolves its own group membership.
    copyCatalogItems(data)
    const inventorySource =
      game === "dos2-overhaul" ? [...library.items.dos2, ...library.items[game]] : library.items[game]
    const localizer = new CatalogLocalizer(game)
    const inventory = inventorySource.map((sourceItem) => localizer.item(sourceItem))
    Item.assignDataKeys([
      ...data.recipes.flatMap((row) => [...row.results(), ...(row.result.pool ?? []), ...row.ingredients]),
      ...data.upgrades!.flatMap((upgrade) => [upgrade.target, ...upgrade.ingredients]),
      ...inventory,
    ])
    writes.push(
      fs.writeFile(path.join(outputDirectory, `data/descriptions-${game}.json`), JSON.stringify(descriptions[game])),
    )
    attachItemData(data, inventory, new IconAtlas(icons, game), effects[game] ?? {}, new Set(rarity[game]?.unique))
    // Upgrade ingredients such as "#Mystical-Small-Rune" are groups too.
    const upgradeSelectors = data.upgrades!.flatMap((upgrade) => upgrade.ingredients.filter((item) => item.isGroup()))
    const resolvedGroups = new ItemGroupResolver(data.recipes, [...inventory, ...upgradeSelectors]).groups(1)
    data.recipes = new SmallGroupExpander(resolvedGroups).expand(data.recipes)
    Object.assign(data, recipeStats(data, tagLocalisation[game]))
    const groups: ItemGroups = Object.fromEntries(
      Object.entries(resolvedGroups).filter(
        ([, group]) => group.members.length >= 4 || GroupMatcher.isGameGroup(group.name),
      ),
    )
    data.groups = groups
    for (const row of data.recipes) {
      const effectLabels = noteLabels(row.notes, tagLocalisation[game])
      if (Object.keys(effectLabels).length) row.effectLabels = effectLabels
      for (const item of [row.result, ...row.ingredients]) markGroup(item, groups)
    }
    for (const item of data.upgrades!.flatMap((upgrade) => upgrade.ingredients)) markGroup(item, groups)
    // Only now: the groups of upgrade targets are for upgrades alone, not for ingredients sharing their name.
    const upgradeGroups = linkUpgradeTargets(data, groups, inventory)
    // From here on an upgrade is an item like any other: the recipes giving it join the catalog's own.
    data.recipes = [...data.recipes, ...mergeUpgradeTargets(data.upgrades!, groups, upgradeGroups)]
    nameUpgradeTargets(data.recipes, groups, upgradeGroups, targetNames)
    delete data.upgrades
    // Slot groups joined into a wider one are left without a use.
    const used = new Set(data.recipes.flatMap((row) => (row.isUpgrade ? (row.ingredients[0].groupId ?? []) : [])))
    for (const id of upgradeGroups) if (!used.has(id)) delete groups[id]
    Object.assign(data, recipeStats(data, tagLocalisation[game]))
    // Items only used in upgrades are ingredients too; the item an upgrade applies to is not.
    const consumed = data.recipes.map((row) =>
      row.isUpgrade ? row.with({ ingredients: row.consumedIngredients() }) : row,
    )
    data.stock = new ItemList(consumed).stock()
    data.itemTags = recipeStats({ ...data, recipes: data.itemRows() }, tagLocalisation[game]).tags
    writes.push(fs.writeFile(path.join(outputDirectory, `data/catalog-${game}.json`), JSON.stringify(data)))
  }
  await Promise.all(writes)
  const pages = [...library.pages, ...upgradePages(Object.values(catalogs), library.pages)]
  const manifest: CatalogManifest = {
    pages,
    itemRoles: CraftRoles.ofCatalogs(pages, catalogs),
    traitGroups: TagSidebar.traitGroups(),
    catalogs: Object.fromEntries(
      Object.entries(catalogs).map(([game, data]) => [
        game,
        { recipes: data.recipes.length, items: new ItemList(data.itemRows()).items().length },
      ]),
    ) as CatalogManifest["catalogs"],
  }
  await fs.writeFile(path.join(outputDirectory, "data/manifest.json"), JSON.stringify(manifest))
  console.log(
    `Dane JSON: ${pages.length} stron; DOS1 ${catalogs.dos1.recipes.length}, DOS2 ${catalogs.dos2.recipes.length}, Overhaul ${catalogs["dos2-overhaul"].recipes.length} receptur (${((performance.now() - started) / 1000).toFixed(2)} s).`,
  )
  return manifest
}

/**
 * The upgrades' item pages of every catalog, one per name, carrying the tags of every upgrade sharing it;
 * none may take the address of a library page.
 */
function upgradePages(catalogs: Catalog[], library: PageSummary[]): PageSummary[] {
  const taken = new Set(library.map((page) => page.slug))
  const pages = new Map<string, PageSummary>()
  const boosts = catalogs.flatMap((data) => data.recipes.filter((row) => row.isUpgrade).map((row) => row.result))
  for (const item of boosts) {
    const slug = item.slug!
    assert.ok(!taken.has(slug), `Upgrade page takes the address of an item page: ${slug}`)
    const known = pages.get(slug)
    if (known) known.tags = [...new Set([...known.tags, ...item.tags])]
    else pages.set(slug, { slug, title: item.name, titlePl: item.namePl, tags: item.tags })
  }
  return [...pages.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

/** Each catalog gets its own copies of the shared items, since it fills them in differently. */
function copyCatalogItems(data: Catalog) {
  const copy = (item: Item) => item.with({})
  data.recipes = data.recipes.map((row) =>
    row.with({
      result: row.result.pool ? row.result.with({ pool: row.result.pool.map(copy) }) : copy(row.result),
      ...(row.extraResults && { extraResults: row.extraResults.map(copy) }),
      ingredients: row.ingredients.map(copy),
    }),
  )
  data.upgrades = (data.upgrades ?? []).map((upgrade) =>
    upgrade.with({ target: copy(upgrade.target), ingredients: upgrade.ingredients.map(copy) }),
  )
}

/** A recipe-specific effect of a result, else the item's own effect. */
function recipeItemEffect(row: Recipe, item: Item, effects: Effects): Item["effect"] {
  const entry = effects[item.effectKey]
  const own = row.results().includes(item) ? entry?.recipes?.[row.id] : undefined
  return own || (entry?.en ? { en: entry.en, pl: entry.pl } : undefined)
}

/** Icons and confirmed game effects of every item a catalog shows. */
function attachItemData(data: Catalog, inventory: Item[], atlas: IconAtlas, effects: Effects, uniques: Set<string>) {
  const markUnique = (item: Item) => {
    if (!item.selectorTag && uniques.has(item.effectKey)) item.unique = true
  }
  for (const row of data.recipes) {
    for (const item of [...row.results(), ...(row.result.pool ?? []), ...row.ingredients]) {
      item.icon = atlas.iconOf(item)
      markUnique(item)
      if (!item.selectorTag) item.effect = recipeItemEffect(row, item, effects)
      delete item.groupId
      delete item.groupSize
    }
  }
  for (const upgrade of data.upgrades ?? [])
    for (const item of [upgrade.target, ...upgrade.ingredients]) {
      item.icon = atlas.iconOf(item)
      markUnique(item)
    }
  for (const item of inventory) {
    item.icon = atlas.iconOf(item)
    markUnique(item)
    const entry = effects[item.effectKey]
    item.effect = entry?.en ? (entry as Item["effect"]) : undefined
  }
}

/** Tag and requirement counts of the expanded recipes, keeping the labels already known. */
function recipeStats(data: Pick<Catalog, "recipes" | "tags" | "requirements">, tagLocalisation: Localised) {
  const statLabels = new Map(
    [...data.tags, ...data.requirements].filter((stat) => stat.label).map((stat) => [stat.tag, stat.label!]),
  )
  const counted = new RecipeStats(data.recipes)
  const stats = { tags: counted.tags(), requirements: counted.requirements() }
  for (const field of ["tags", "requirements"] as const)
    for (const stat of stats[field]) stat.label = statLabels.get(stat.tag) ?? stat.label
  for (const stat of stats.tags) {
    const localized = tagLocalisation?.[stat.tag]
    if (localized) stat.label = localized.pl || stat.label || localized.en
  }
  return stats
}

/** Upgrade targets link to the groups of items they apply to; returns the ids of the groups it added. */
function linkUpgradeTargets(data: Catalog, groups: ItemGroups, inventory: Item[]): Set<string> {
  const added = new Set<string>()
  const targets = new ItemGroupResolver(data.recipes, inventory).upgradeTargets(data.upgrades ?? [])
  for (const upgrade of data.upgrades ?? []) {
    // A target without catalog items stays a plain label, applying to no item rather than to its whole category.
    const resolved = targets[upgrade.id] ?? []
    upgrade.targets = resolved.map((group) => {
      // A slot without catalog items stays a plain label.
      if (group.members.length === 0) return new Item({ name: group.name, tags: upgrade.target.tags })
      const key = freeGroupKey(groups, group)
      if (!groups[key]) added.add(key)
      groups[key] = new ItemGroup({ ...group, id: key })
      return new Item({ name: group.name, tags: upgrade.target.tags, groupId: key, groupSize: group.members.length })
    })
  }
  return added
}

/**
 * The upgrades' recipes, those giving the same boost from the same ingredients joined into one: the groups
 * of items they apply to become one group (a shirt, gloves and boots upgraded with the same scrap, say).
 */
function mergeUpgradeTargets(upgrades: Upgrade[], groups: ItemGroups, upgradeGroups: Set<string>): Recipe[] {
  const joined = new Map<string, { rows: Recipe[]; targets: Item[]; split: boolean }>()
  const order: Array<Recipe | string> = []
  for (const upgrade of upgrades) {
    const recipes = upgrade.recipes()
    const split = recipes.length > 1
    for (const row of recipes) {
      const target = row.ingredients[0]
      if (!target.groupId || !groups[target.groupId]) {
        // A slot without catalog items is named by the target of its other slots ("Chest, Gloves or Sarong").
        if (!split) order.push(row)
        continue
      }
      const key = JSON.stringify([
        row.result.slug,
        row.consumedIngredients().map((item) => [item.slug ?? item.name, item.groupId, item.quantity]),
        row.requirements,
        row.remarks,
        row.source,
        [...row.tags].sort(),
      ])
      const entry = joined.get(key)
      if (!entry) {
        joined.set(key, { rows: [row], targets: [upgrade.target], split })
        order.push(key)
      } else {
        entry.rows.push(row)
        if (!entry.targets.includes(upgrade.target)) entry.targets.push(upgrade.target)
        entry.split ||= split
      }
    }
  }
  return order.map((entry) =>
    typeof entry === "string" ? joinedUpgrade(joined.get(entry)!, groups, upgradeGroups) : entry,
  )
}

/** One recipe for upgrades differing only in the item they apply to, applying to every one of those items. */
function joinedUpgrade(
  { rows, targets, split }: { rows: Recipe[]; targets: Item[]; split: boolean },
  groups: ItemGroups,
  upgradeGroups: Set<string>,
): Recipe {
  const [first] = rows
  if (rows.length === 1 && !split) return first
  const members = new Map<string, Item>()
  for (const row of rows)
    for (const member of groups[row.ingredients[0].groupId!].members) members.set(member.slug ?? member.name, member)
  // One library target split into slots keeps its own name; several are listed by name until named.
  const name = targets.length === 1 ? targets[0].name : targets.map((item) => Item.displayName(item.name)).join("; ")
  const namePl = targets.length === 1 ? targets[0].namePl : undefined
  const group = new ItemGroup({
    id: TextKey.item(name),
    name,
    members: [...members.values()].sort((a, b) => a.name.localeCompare(b.name)),
  })
  const key = freeGroupKey(groups, group)
  if (!groups[key]) upgradeGroups.add(key)
  groups[key] = new ItemGroup({ ...group, id: key })
  const target = new Item({
    name,
    namePl,
    tags: [...new Set(rows.flatMap((row) => row.ingredients[0].tags))],
    groupId: key,
    groupSize: group.members.length,
  })
  return first.with({
    ingredients: [target, ...first.consumedIngredients()],
    sourceRecipeIds: rows.flatMap((row) => row.sourceRecipeIds ?? [row.id]),
  })
}

/**
 * Upgrade targets get the names chosen for them in data/upgradeTargetNames.json, and so do the groups only
 * upgrades use. Joined targets must have one: their generated name only lists what was joined.
 */
function nameUpgradeTargets(recipes: Recipe[], groups: ItemGroups, upgradeGroups: Set<string>, names: TargetNames) {
  for (const row of recipes) {
    if (!row.isUpgrade) continue
    const target = row.ingredients[0]
    const generated = Item.displayName(target.name)
    const chosen = names[generated]
    assert.ok(chosen || !generated.includes("; "), `Missing name in data/upgradeTargetNames.json: ${generated}`)
    if (!chosen) continue
    row.ingredients = [target.with({ name: chosen.en, namePl: chosen.pl }), ...row.consumedIngredients()]
    const id = target.groupId
    if (id && upgradeGroups.has(id)) groups[id] = new ItemGroup({ ...groups[id], name: chosen.en })
  }
}

/** The group's own id, or a numbered one when another group with different members holds it. */
function freeGroupKey(groups: ItemGroups, group: ItemGroup): string {
  let key = group.id
  let suffix = 1
  while (groups[key] && groups[key].memberNames() !== group.memberNames()) {
    key = `${group.id}-${suffix}`
    suffix++
  }
  return key
}

/** The game's own words for the terms a saved effect note uses. */
function noteLabels(notes: string, tagLocalisation: Localised): Record<string, string> {
  const vocabulary = Object.values(tagLocalisation ?? {})
  return Object.fromEntries(
    vocabulary
      .filter((entry) => entry.pl && notes.toLocaleLowerCase().includes(entry.en.toLocaleLowerCase()))
      .map((entry) => [entry.en.toLocaleLowerCase(), entry.pl!]),
  )
}

/** A group ingredient links to its group and shows no icon of its own. */
function markGroup(item: Item, groups: ItemGroups) {
  const group = groups[item.nameKey]
  if (!group || !item.isGroup()) return
  item.groupId = group.id
  item.groupSize = group.members.length
  delete item.icon
}

if (process.argv[1]?.endsWith("generate-data.ts")) await generateData()
