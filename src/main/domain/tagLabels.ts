import type { TagStat } from "./recipeStats"

/** The names readers see for tags; a tag without one reads as its words ("Two-Handed" → "Two Handed"). */
export class TagLabels {
  constructor(private readonly labels: Record<string, string> = {}) {}

  /** The labels of a catalog's tag statistics. */
  static of(stats: TagStat[]): TagLabels {
    return new TagLabels(Object.fromEntries(stats.map((entry) => [entry.tag, entry.label ?? entry.tag])))
  }

  label(tag: string): string {
    return this.labels[tag] ?? tag.replaceAll("-", " ")
  }
}
