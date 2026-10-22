import { buildItemGroups, expandSmallGroups, isItemGroup } from "../src/main/domain/itemGroups"
import { itemIconKey, itemDataKey } from "../src/main/domain/itemIcons"
import fs from "node:fs/promises"
import path from "node:path"
import { resolveItemIcon, type ItemIconMap } from "../src/main/domain/itemIcons"
import { buildCatalogs } from "../src/main/domain/recipeCatalog"
import { getCatalogItemRoles } from "../src/main/domain/recipeItemRoles"
import { catalogItems } from "../src/main/domain/recipeView"
import { collectRecipeStats, getCechySidebarGroups } from "../src/main/domain/recipes"
import { resetLocalisationSources } from "../src/main/domain/itemLocalisation"
import { localizeItemForCatalog } from "../src/main/domain/recipes"
import { isPublicPage } from "../src/main/routing"
import type { PageSummary, CatalogManifest } from "../src/main/domain/types"
import { loadLibrary } from "./load-library"
import { recipeResults } from "../src/main/domain/recipeResults"

/** Writes `<outputDirectory>/data`; the build passes `dist`, so the catalog data lands next to the app. */
export async function generateData(outputDirectory = "dist") {
  const started = performance.now()
  resetLocalisationSources()
  // Validate source JSON before replacing the previously generated output.
  const library = await loadLibrary()
  const labels: Record<string, string> = JSON.parse(await fs.readFile("data/tagLabels.json", "utf8"))
  const catalogs = buildCatalogs(library.sources, library.pages, labels, library.upgrades)
  const descriptions = JSON.parse(await fs.readFile("data/itemDescriptions.json", "utf8"))
  const tagLocalisation = JSON.parse(await fs.readFile("data/tagLocalisation.json", "utf8"))
  const effects = JSON.parse(await fs.readFile("data/itemEffects.json", "utf8"))
  const icons: ItemIconMap = JSON.parse(await fs.readFile("data/itemIcons.json", "utf8"))
  await fs.rm(path.join(outputDirectory, "data"), { recursive: true, force: true })
  await fs.mkdir(path.join(outputDirectory, "data"), { recursive: true })
  await fs.cp("assets/item-icons", path.join(outputDirectory, "data/icons"), { recursive: true })
  for (const game of Object.keys(catalogs) as (keyof typeof catalogs)[]) {
    const data = catalogs[game]
    // Catalogs share base recipes; each mode resolves its own group membership.
    data.recipes = data.recipes.map((row) => ({
      ...row,
      result: row.result.pool
        ? { ...row.result, pool: row.result.pool.map((item) => ({ ...item })) }
        : { ...row.result },
      ...(row.extraResults && { extraResults: row.extraResults.map((item) => ({ ...item })) }),
      ingredients: row.ingredients.map((item) => ({ ...item })),
    }))
    await fs.writeFile(path.join(outputDirectory, `data/descriptions-${game}.json`), JSON.stringify(descriptions[game]))
    for (const row of data.recipes) {
      for (const item of [...recipeResults(row), ...(row.result.pool ?? []), ...row.ingredients]) {
        item.icon = resolveItemIcon(icons, game, item)
        if (!item.selectorTag) {
          const entry = effects[game]?.[itemDataKey(item)]
          item.effect =
            (recipeResults(row).includes(item) && entry?.recipes?.[row.id]) ||
            (entry?.en ? { en: entry.en, pl: entry.pl } : undefined)
        }
        delete item.groupId
        delete item.groupSize
      }
    }
    data.upgrades = (data.upgrades ?? []).map((upgrade) => {
      const copy = {
        ...upgrade,
        target: { ...upgrade.target },
        ingredients: upgrade.ingredients.map((item) => ({ ...item })),
      }
      for (const item of [copy.target, ...copy.ingredients]) item.icon = resolveItemIcon(icons, game, item)
      return copy
    })
    const inventory = (
      game === "dos2-overhaul" ? [...library.items.dos2, ...library.items[game]] : library.items[game]
    ).map((sourceItem) => {
      const item = localizeItemForCatalog(sourceItem, game)
      return {
        ...item,
        icon: resolveItemIcon(icons, game, item),
        effect: effects[game]?.[itemDataKey(item)]?.en ? effects[game][itemDataKey(item)] : undefined,
      }
    })
    const resolvedGroups = buildItemGroups(data.recipes, 1, inventory)
    data.recipes = expandSmallGroups(data.recipes, resolvedGroups)
    const statLabels = new Map(
      [...data.tags, ...data.requirements, ...data.selectors]
        .filter((stat) => stat.label)
        .map((stat) => [stat.tag, stat.label!]),
    )
    const stats = collectRecipeStats(data.recipes)
    for (const field of ["tags", "requirements", "selectors"] as const)
      for (const stat of stats[field]) stat.label = statLabels.get(stat.tag) ?? stat.label
    for (const stat of stats.tags) {
      const localized = tagLocalisation[game]?.[stat.tag]
      if (localized) stat.label = localized.pl || stat.label || localized.en
    }
    Object.assign(data, stats)
    data.groups = Object.fromEntries(Object.entries(resolvedGroups).filter(([, group]) => group.members.length >= 4))
    for (const row of data.recipes) {
      const vocabulary = Object.values(tagLocalisation[game] ?? {}) as { en: string; pl?: string }[]
      const effectLabels = Object.fromEntries(
        vocabulary
          .filter((entry) => entry.pl && row.notes.toLocaleLowerCase().includes(entry.en.toLocaleLowerCase()))
          .map((entry) => [entry.en.toLocaleLowerCase(), entry.pl!]),
      )
      if (Object.keys(effectLabels).length) row.effectLabels = effectLabels
      for (const item of [row.result, ...row.ingredients]) {
        const group = data.groups[itemIconKey(item.name)]
        if (group && isItemGroup(item)) {
          item.groupId = group.id
          item.groupSize = group.members.length
          delete item.icon
        }
      }
    }
    await fs.writeFile(path.join(outputDirectory, `data/catalog-${game}.json`), JSON.stringify(data))
  }
  const publishedPages = library.pages.filter(isPublicPage)
  const pages: PageSummary[] = publishedPages.map(({ slug, title, titlePl, tags, itemPage, categoryPage }) => ({
    slug,
    title,
    titlePl,
    tags,
    itemPage,
    categoryPage,
  }))
  const manifest: CatalogManifest = {
    pages,
    itemRoles: getCatalogItemRoles(pages, catalogs),
    traitGroups: getCechySidebarGroups(),
    catalogs: Object.fromEntries(
      Object.entries(catalogs).map(([game, data]) => [
        game,
        { recipes: data.recipes.length, items: catalogItems(data.recipes).length },
      ]),
    ) as CatalogManifest["catalogs"],
  }
  await fs.writeFile(path.join(outputDirectory, "data/manifest.json"), JSON.stringify(manifest))
  console.log(
    `Dane JSON: ${pages.length} stron; DOS1 ${catalogs.dos1.recipes.length}, DOS2 ${catalogs.dos2.recipes.length}, Overhaul ${catalogs["dos2-overhaul"].recipes.length} receptur (${((performance.now() - started) / 1000).toFixed(2)} s).`,
  )
  return manifest
}
if (process.argv[1]?.endsWith("generate-data.ts")) await generateData()
