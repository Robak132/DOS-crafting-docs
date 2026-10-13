import fs from "fs"
import path from "path"

let cachedExact: Map<string, string> | null = null
let cachedFold: Map<string, string> | null = null
let cachedReverseExact: Map<string, string> | null = null
let cachedReverseFold: Map<string, string> | null = null

function normalizeFold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ł", "l")
    .replaceAll("Ł", "l")
    .trim()
    .toLowerCase()
}

function loadMaps(): {
  exact: Map<string, string>
  fold: Map<string, string>
  reverseExact: Map<string, string>
  reverseFold: Map<string, string>
} {
  if (cachedExact && cachedFold && cachedReverseExact && cachedReverseFold) {
    return {
      exact: cachedExact,
      fold: cachedFold,
      reverseExact: cachedReverseExact,
      reverseFold: cachedReverseFold,
    }
  }

  const exact = new Map<string, string>()
  const fold = new Map<string, string>()
  const reverseExact = new Map<string, string>()
  const reverseFold = new Map<string, string>()
  const dataDir = path.join(process.cwd(), "quartz", "data")
  const files = ["itemLocalisation.en-pl.json", "itemLocalisation.dos1-ee.en-pl.json"]
  try {
    for (const file of files) {
      const filePath = path.join(dataDir, file)
      if (!fs.existsSync(filePath)) continue
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, string>
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
  } catch {
    // Optional during early setup
  }

  cachedExact = exact
  cachedFold = fold
  cachedReverseExact = reverseExact
  cachedReverseFold = reverseFold
  return { exact, fold, reverseExact, reverseFold }
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
export function resolveItemNames(raw: string): { name: string; namePl?: string } {
  const key = localisationLookupKey(raw)
  if (!key) return { name: raw }
  const { exact, fold, reverseExact, reverseFold } = loadMaps()

  const plFromEn = exact.get(key) ?? exact.get(raw) ?? fold.get(normalizeFold(key))
  if (plFromEn && plFromEn !== key) {
    return { name: key, namePl: plFromEn }
  }

  const enFromPl = reverseExact.get(key) ?? reverseExact.get(raw) ?? reverseFold.get(normalizeFold(key))
  if (enFromPl && enFromPl !== key) {
    return { name: enFromPl, namePl: key }
  }

  return { name: key }
}
