import { Item, type ItemData } from "./item"
import { ItemGroup, type ItemGroupData, type ItemGroups } from "./itemGroup"
import { Recipe, type RecipeData } from "./recipe"
import { RecipeStats, type TagStat } from "./recipeStats"
import { TagLabels } from "./tagLabels"
import { TextKey } from "./textKey"
import type { PageSummary } from "./types"
import { Upgrade, type UpgradeData } from "./upgrade"

/** A game's catalog as written to data/catalog-<game>.json. */
export type CatalogData = {
  recipes: RecipeData[]
  tags: TagStat[]
  requirements: TagStat[]
  upgrades?: UpgradeData[]
  groups?: Record<string, ItemGroupData>
  /** Items only ever used as ingredients; the item list shows them too. */
  stock?: ItemData[]
  /** Tag counts of the item list: what the recipes give and the stock. */
  itemTags?: TagStat[]
}

/** Everything one game offers: its recipes, upgrades, item groups and tag counts. */
export class Catalog {
  declare recipes: Recipe[]
  declare tags: TagStat[]
  declare requirements: TagStat[]
  declare upgrades?: Upgrade[]
  declare groups?: ItemGroups
  declare stock?: Item[]
  declare itemTags?: TagStat[]

  constructor(data: CatalogData) {
    Object.assign(this, data)
    this.recipes = data.recipes.map(Recipe.from)
    if (data.upgrades) this.upgrades = data.upgrades.map(Upgrade.from)
    if (data.stock) this.stock = data.stock.map(Item.from)
    if (data.groups)
      this.groups = Object.fromEntries(Object.entries(data.groups).map(([id, group]) => [id, ItemGroup.from(group)]))
  }

  /** A catalog of these recipes, with their tag and requirement counts. */
  static of(recipes: Recipe[], tagLabels: Record<string, string> = {}): Catalog {
    const stats = new RecipeStats(recipes, tagLabels)
    return new Catalog({ recipes, tags: stats.tags(), requirements: stats.requirements() })
  }

  /** The labels readers see for this catalog's tags. */
  tagLabels(): TagLabels {
    return TagLabels.of([...(this.itemTags ?? []), ...this.tags])
  }

  /** The recipes giving the upgrades as items of their own. */
  upgradeRecipes(): Recipe[] {
    return (this.upgrades ?? []).map((upgrade) => upgrade.recipe())
  }

  /** The rows of the item list: every recipe and upgrade, and a listing for each item only used as an ingredient. */
  itemRows(): Recipe[] {
    return [...this.recipes, ...this.upgradeRecipes(), ...(this.stock ?? []).map(Recipe.listing)]
  }

  /** The recipes making the item of this page, the upgrades giving it included. */
  recipesMaking(slug: string): Recipe[] {
    return [...this.recipes, ...this.upgradeRecipes()].filter((row) => row.makes(slug))
  }

  /** Item pages of the upgrades, one per name; each carries the tags of every upgrade sharing it. */
  upgradePages(): PageSummary[] {
    const pages = new Map<string, PageSummary>()
    for (const item of (this.upgrades ?? []).map((upgrade) => upgrade.item())) {
      const page = pages.get(item.slug!)
      if (page) page.tags = [...new Set([...page.tags, ...item.tags])]
      else pages.set(item.slug!, { slug: item.slug!, title: item.name, titlePl: item.namePl, tags: item.tags })
    }
    return [...pages.values()]
  }

  /** The recipes whose random result can be the item of this page (by slug, or by name for unlinked entries). */
  recipesRolling(slug: string, title: string): Recipe[] {
    const keys = TextKey.names(title, slug)
    return this.recipes.filter((row) => row.canRoll(slug, keys))
  }

  /** The recipes taking the item of this page as an ingredient (by slug, or by name for groups). */
  recipesUsing(slug: string, title: string): Recipe[] {
    const keys = TextKey.names(title, slug)
    return this.recipes.filter((row) => row.uses(slug, keys))
  }

  /** The upgrades applying to an item with these tags. */
  upgradesFor(itemTags: string[], slug: string): Upgrade[] {
    return (this.upgrades ?? []).filter((upgrade) => upgrade.appliesTo(itemTags, slug, this.groups))
  }

  /** The upgrades taking the item of this page as an ingredient, directly or through a group. */
  upgradesUsing(slug: string, title: string): Upgrade[] {
    const keys = TextKey.names(title, slug)
    return (this.upgrades ?? []).filter((upgrade) => upgrade.uses(slug, keys, this.groups))
  }

  /** The item of a page as the catalog shows it: a product first, else a pool entry, else an ingredient. */
  findItem(slug: string): Item | undefined {
    const made = this.recipesMaking(slug)
    return (
      made.flatMap((row) => row.results()).find((item) => item.slug === slug) ??
      made[0]?.result ??
      this.recipes.flatMap((row) => row.result.pool ?? []).find((item) => item.slug === slug) ??
      this.recipes.flatMap((row) => row.ingredients).find((item) => item.slug === slug)
    )
  }
}
