import fs from "fs"
import path from "path"

import type { RecipeCatalog } from "./recipes"

const cachedMaps = new Map<string, Map<string, string>>()

/** The English → Polish name maps of a catalog, in priority order. */
function localisationSources(catalog: RecipeCatalog, context: "item" | "selector"): Record<string, string>[] {
  const dataDir = path.join(process.cwd(), "data")
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"))
  if (catalog === "dos1") return [read("itemLocalisation.en-pl.json"), read("itemLocalisation.dos1-ee.en-pl.json")]
  const data = read("itemLocalisation.dos2-de.en-pl.json")
  return [{ ...data.names, ...(context === "selector" ? data.selectors : {}) }]
}

function loadMap(catalog: RecipeCatalog, context: "item" | "selector"): Map<string, string> {
  const key = `${catalog === "dos1" ? "dos1" : "dos2-de"}:${context}`
  const cached = cachedMaps.get(key)
  if (cached) return cached
  const map = new Map<string, string>()
  // Główna mapa ma pierwszeństwo; DOS1 EE uzupełnia braki.
  for (const source of localisationSources(catalog, context))
    for (const [en, pl] of Object.entries(source)) if (en && pl && !map.has(en)) map.set(en, pl)
  cachedMaps.set(key, map)
  return map
}

/** The Polish name of an English item or selector name, from the game's own dictionary. */
export function polishName(
  name: string,
  catalog: RecipeCatalog,
  context: "item" | "selector" = "item",
): string | undefined {
  return loadMap(catalog, context).get(name)
}

export function resetLocalisationSources(): void {
  cachedMaps.clear()
}
