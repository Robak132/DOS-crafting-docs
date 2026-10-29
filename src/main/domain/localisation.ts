import fs from "fs"
import path from "path"

import { Item } from "./item"
import type { Game } from "./game"
import type { Recipe } from "./recipe"
import type { Upgrade } from "./upgrade"

type NameContext = "item" | "selector"

/** The game's own English → Polish names, read from data/itemLocalisation*.json. */
export class NameDictionary {
  private static readonly cache = new Map<string, NameDictionary>()

  private constructor(private readonly names: Map<string, string>) {}

  /** The dictionary of a game: DOS1 Enhanced Edition, or Definitive Edition for DOS2 and Overhaul. */
  static of(game: Game, context: NameContext = "item"): NameDictionary {
    const key = `${game === "dos1" ? "dos1" : "dos2-de"}:${context}`
    let dictionary = NameDictionary.cache.get(key)
    if (!dictionary) {
      const names = new Map<string, string>()
      // Główna mapa ma pierwszeństwo; DOS1 EE uzupełnia braki.
      for (const source of NameDictionary.sources(game, context))
        for (const [en, pl] of Object.entries(source)) if (en && pl && !names.has(en)) names.set(en, pl)
      dictionary = new NameDictionary(names)
      NameDictionary.cache.set(key, dictionary)
    }
    return dictionary
  }

  /** Forget the loaded files, so the next lookup reads them again. */
  static reset(): void {
    NameDictionary.cache.clear()
  }

  private static sources(game: Game, context: NameContext): Record<string, string>[] {
    const read = (file: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", file), "utf8"))
    if (game === "dos1") return [read("itemLocalisation.en-pl.json"), read("itemLocalisation.dos1-ee.en-pl.json")]
    const data = read("itemLocalisation.dos2-de.en-pl.json")
    return [{ ...data.names, ...(context === "selector" ? data.selectors : {}) }]
  }

  /** The Polish name of an English one. */
  polish(name: string): string | undefined {
    return this.names.get(name)
  }
}

/** Gives the items of one game's catalog their Polish names; English stays the base name. */
export class CatalogLocalizer {
  constructor(private readonly game: Game) {}

  item(item: Item): Item {
    if (item.pool) {
      // The pool follows the localized fields, as the catalog has always listed it.
      const { pool, ...base } = item
      return this.item(new Item(base)).with({ pool: pool.map((entry) => this.item(entry)) })
    }
    if (item.selectorTag) {
      const label = item.name.replace(/^#/, "")
      const namePl = NameDictionary.of(this.game, "selector").polish(label)
      return item.with({
        name: `#${label}`,
        namePl: (this.game === "dos1" ? item.namePl : undefined) ?? (namePl ? `#${namePl}` : undefined),
      })
    }
    // DOS1 zachowuje titlePl; DOS2 i Overhaul używają wyłącznie słownika Definitive Edition.
    if (this.game === "dos1" && item.namePl && item.namePl !== item.name) return item.with({})
    const namePl = NameDictionary.of(this.game).polish(item.name)
    // A qualifier becomes part of the shown name: "Sword (Ornate)".
    const { nameQualifier, ...base } = item
    const qualifierPl = nameQualifier ? ` (${nameQualifier.pl ?? nameQualifier.en})` : ""
    return new Item({
      ...base,
      name: item.name + (nameQualifier ? ` (${nameQualifier.en})` : ""),
      namePl: namePl ? namePl + qualifierPl : undefined,
    })
  }

  recipe(row: Recipe): Recipe {
    return row.with({
      result: this.item(row.result),
      ...(row.extraResults && { extraResults: row.extraResults.map((item) => this.item(item)) }),
      ingredients: row.ingredients.map((item) => this.item(item)),
    })
  }

  upgrade(upgrade: Upgrade): Upgrade {
    const effect = this.item(new Item({ name: upgrade.effect.en, namePl: upgrade.effect.pl, tags: [] }))
    return upgrade.with({
      effect: { en: upgrade.effect.en, pl: upgrade.effect.pl ?? effect.namePl },
      target: this.item(upgrade.target),
      ingredients: upgrade.ingredients.map((item) => this.item(item)),
    })
  }
}
