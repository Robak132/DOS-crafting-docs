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

function loadMaps(catalog: RecipeCatalog, context: "item" | "selector"): NameMaps {
  const key = `${catalog === "dos1" ? "dos1" : "dos2-de"}:${context}`
  const cached = cachedMaps.get(key)
  if (cached) return cached

  const exact = new Map<string, string>()
  const fold = new Map<string, string>()
  const reverseExact = new Map<string, string>()
  const reverseFold = new Map<string, string>()
  const dataDir = path.join(process.cwd(), "data")
  const files =
    catalog === "dos1"
      ? ["itemLocalisation.en-pl.json", "itemLocalisation.dos1-ee.en-pl.json"]
      : ["itemLocalisation.dos2-de.en-pl.json"]
  for (const file of files) {
    const filePath = path.join(dataDir, file)
    if (!fs.existsSync(filePath)) continue
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"))
    const raw: Record<string, string> =
      catalog === "dos1" ? data : { ...data.names, ...(context === "selector" ? data.selectors : {}) }
    for (const [en, pl] of Object.entries(raw)) {
      if (!en || !pl) continue
      // Główna mapa ma pierwszeństwo; DOS1 EE uzupełnia braki.
      if (!exact.has(en)) exact.set(en, pl)
      const enKey = normalizeFold(en)
      if (!fold.has(enKey)) fold.set(enKey, pl)
      if (!reverseExact.has(pl)) reverseExact.set(pl, en)
      const plKey = normalizeFold(pl)
      if (!reverseFold.has(plKey)) reverseFold.set(plKey, en)
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
