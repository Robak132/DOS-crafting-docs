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
import { RecipeStats } from "../src/main/domain/recipeStats"
import { SmallGroupExpander } from "../src/main/domain/smallGroupExpander"
import { TagSidebar } from "../src/main/domain/tagSidebar"
import type { CatalogManifest, PageSummary } from "../src/main/domain/types"
import { loadLibrary } from "./load-library"

type Localised = Record<string, { en: string; pl?: string }> | undefined
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
    linkUpgradeTargets(data, groups, inventory)
    for (const row of data.recipes) {
      const effectLabels = noteLabels(row.notes, tagLocalisation[game])
      if (Object.keys(effectLabels).length) row.effectLabels = effectLabels
      for (const item of [row.result, ...row.ingredients]) markGroup(item, groups)
    }
    for (const item of data.upgrades!.flatMap((upgrade) => upgrade.ingredients)) markGroup(item, groups)
    // Items only used in upgrades are ingredients too; the item an upgrade applies to is not.
    const upgradeUses = data.upgradeRecipes().map((row) => row.with({ ingredients: row.ingredients.slice(1) }))
    data.stock = new ItemList([...data.recipes, ...upgradeUses]).stock()
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

/** The upgrades' item pages of every catalog, one per name; none may take the address of a library page. */
function upgradePages(catalogs: Catalog[], library: PageSummary[]): PageSummary[] {
  const taken = new Set(library.map((page) => page.slug))
  const pages = new Map<string, PageSummary>()
  for (const page of catalogs.flatMap((data) => data.upgradePages())) {
    assert.ok(!taken.has(page.slug), `Upgrade page takes the address of an item page: ${page.slug}`)
    const known = pages.get(page.slug)
    if (known) known.tags = [...new Set([...known.tags, ...page.tags])]
    else pages.set(page.slug, page)
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

/** Upgrade targets link to the groups of items they apply to. */
function linkUpgradeTargets(data: Catalog, groups: ItemGroups, inventory: Item[]) {
  const targets = new ItemGroupResolver(data.recipes, inventory).upgradeTargets(data.upgrades ?? [])
  for (const upgrade of data.upgrades ?? []) {
    const resolved = targets[upgrade.id] ?? []
    if (!resolved.some((group) => group.members.length > 0)) continue
    upgrade.targets = resolved.map((group) => {
      // A slot without catalog items stays a plain label.
      if (group.members.length === 0) return new Item({ name: group.name, tags: upgrade.target.tags })
      const key = freeGroupKey(groups, group)
      groups[key] = new ItemGroup({ ...group, id: key })
      return new Item({ name: group.name, tags: upgrade.target.tags, groupId: key, groupSize: group.members.length })
    })
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
