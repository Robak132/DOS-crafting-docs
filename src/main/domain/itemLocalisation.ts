import fs from "fs"
import path from "path"

import type { RecipeCatalog } from "./recipes"

type NameMaps = {
  exact: Map<string, string>
  fold: Map<string, string>
  reverseExact: Map<string, string>
  reverseFold: Map<string, string>
}

const cachedMaps = new Map<string, NameMaps>()

function normalizeFold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .replaceAll("Ł", "l")
    .trim()
    .toLowerCase()
}

/** The English → Polish name maps of a catalog, in priority order. */
function localisationSources(
  dataDir: string,
  catalog: RecipeCatalog,
  context: "item" | "selector",
): Record<string, string>[] {
  const files =
    catalog === "dos1"
      ? ["itemLocalisation.en-pl.json", "itemLocalisation.dos1-ee.en-pl.json"]
      : ["itemLocalisation.dos2-de.en-pl.json"]
  return files
    .map((file) => path.join(dataDir, file))
    .filter((file) => fs.existsSync(file))
    .map((file) => {
      const data = JSON.parse(fs.readFileSync(file, "utf8"))
      if (catalog === "dos1") return data
      return { ...data.names, ...(context === "selector" ? data.selectors : {}) }
    })
}

function loadMaps(catalog: RecipeCatalog, context: "item" | "selector"): NameMaps {
  const key = `${catalog === "dos1" ? "dos1" : "dos2-de"}:${context}`
  const cached = cachedMaps.get(key)
  if (cached) return cached

  const exact = new Map<string, string>()
  const fold = new Map<string, string>()
  const reverseExact = new Map<string, string>()
  const reverseFold = new Map<string, string>()
  // Główna mapa ma pierwszeństwo; DOS1 EE uzupełnia braki.
  const setFirst = (map: Map<string, string>, name: string, value: string) => {
    if (!map.has(name)) map.set(name, value)
  }
  for (const raw of localisationSources(path.join(process.cwd(), "data"), catalog, context)) {
    for (const [en, pl] of Object.entries(raw)) {
      if (!en || !pl) continue
      setFirst(exact, en, pl)
      setFirst(fold, normalizeFold(en), pl)
      setFirst(reverseExact, pl, en)
      setFirst(reverseFold, normalizeFold(pl), en)
    }
  }
  const maps = { exact, fold, reverseExact, reverseFold }
  cachedMaps.set(key, maps)
  return maps
}

/** Extract a lookup key from a wiki target or raw item label. */
export function localisationLookupKey(name: string): string {
  let value = name.trim()
  if (!value) return value
  if (value.startsWith("#")) value = value.slice(1)
  value = value.replace(/^<|>$/g, "")
  if (value.includes("|")) value = value.split("|").at(-1) ?? value
  if (value.includes("/")) value = value.split("/").at(-1) ?? value
  return value.trim()
}

/**
 * Bazowa nazwa = ENG; opcjonalne `namePl` z mapy lokalizacji.
 * Jeśli plik ma tytuł PL, odwracamy mapę gdy to możliwe.
 */
export function resolveItemNames(
  raw: string,
  catalog: RecipeCatalog = "dos1",
  context: "item" | "selector" = "item",
): { name: string; namePl?: string } {
  const key = localisationLookupKey(raw)
  if (!key) return { name: raw }
  const { exact, fold, reverseExact, reverseFold } = loadMaps(catalog, context)

  const plFromEn = exact.get(key) ?? exact.get(raw) ?? fold.get(normalizeFold(key))
  if (plFromEn) {
    return { name: key, namePl: plFromEn }
  }

  const enFromPl = reverseExact.get(key) ?? reverseExact.get(raw) ?? reverseFold.get(normalizeFold(key))
  if (enFromPl && enFromPl !== key) {
    return { name: enFromPl, namePl: key }
  }

  return { name: key }
}

export function resetLocalisationSources(): void {
  cachedMaps.clear()
}
