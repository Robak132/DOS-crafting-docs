import fs from "node:fs/promises"
import path from "node:path"
import sanitizeHtml from "sanitize-html"
import { resolveItemIcon, type ItemIconMap } from "../src/main/domain/itemIcons"
import { buildCatalogs } from "../src/main/domain/recipeCatalog"
import { getItemCraftRoles } from "../src/main/domain/recipeItemRoles"
import { catalogItems } from "../src/main/domain/recipeView"
import { getCechySidebarGroups, resetRecipeSources } from "../src/main/domain/recipes"
import { resetLocalisationSources } from "../src/main/domain/itemLocalisation"
import type { PageSummary, CatalogManifest } from "../src/main/domain/types"
import { loadLibrary } from "./load-library"

export const generatedDir = path.resolve(".generated", "build")
export async function generateData(outputDirectory = generatedDir) {
  const started = performance.now()
  resetRecipeSources()
  resetLocalisationSources()
  // Validate source JSON before replacing the previously generated output.
  const library = await loadLibrary()
  const labels: Record<string, string> = JSON.parse(await fs.readFile("data/tagLabels.json", "utf8"))
  const catalogs = buildCatalogs(library.sources, library.pages, labels)
  const descriptions = JSON.parse(await fs.readFile("data/itemDescriptions.json", "utf8"))
  const icons: ItemIconMap = JSON.parse(await fs.readFile("data/itemIcons.json", "utf8"))
  await fs.rm(outputDirectory, { recursive: true, force: true })
  await fs.mkdir(path.join(outputDirectory, "data/pages"), { recursive: true })
  await fs.cp("assets/item-icons", path.join(outputDirectory, "data/icons"), { recursive: true })
  for (const game of Object.keys(catalogs) as (keyof typeof catalogs)[]) {
    const data = catalogs[game]
    await fs.writeFile(path.join(outputDirectory, `data/descriptions-${game}.json`), JSON.stringify(descriptions[game]))
    for (const row of data.recipes) {
      for (const item of [row.result, ...row.ingredients]) item.icon = resolveItemIcon(icons, game, item)
    }
    await fs.writeFile(path.join(outputDirectory, `data/catalog-${game}.json`), JSON.stringify(data))
  }
  const pages: PageSummary[] = library.pages.map(({ slug, title, titlePl, tags, itemPage, categoryPage }) => ({
    slug,
    title,
    titlePl,
    tags,
    itemPage,
    categoryPage,
  }))
  const aliases: Record<string, string> = {}
  await Promise.all(
    library.pages.map(async ({ aliases: pageAliases, html, ...page }) => {
      for (const alias of pageAliases) {
        if (aliases[alias] && aliases[alias] !== page.slug) throw new Error(`Duplicate alias: ${alias}`)
        aliases[alias] = page.slug
      }
      const safeHtml = sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, img: ["src", "alt"], "*": ["id"] },
      })
      const output = path.join(outputDirectory, "data/pages", `${page.slug}.json`)
      await fs.mkdir(path.dirname(output), { recursive: true })
      await fs.writeFile(output, JSON.stringify({ ...page, html: safeHtml }))
    }),
  )
  const manifest: CatalogManifest = {
    pages,
    aliases,
    itemRoles: getItemCraftRoles(
      pages,
      Object.values(catalogs).flatMap((data) => data.recipes),
    ),
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
