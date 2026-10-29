import type { TagStat } from "./recipeStats"
import { tagHierarchy } from "./tagHierarchy"

export type TagFilterNode = TagStat & { children?: TagFilterNode[] }

/** One collapsible section of the sidebar's tag filters. */
export type TagSection = {
  label: string
  tags: TagFilterNode[]
  /** Sekcje Cechy — bez wcięć ścieżkowych (rodzic jest tytułem grupy). */
  flat?: boolean
}

/** A sidebar section of traits: a hierarchy root and every tag below it. */
export type TraitGroup = {
  parentTag: string
  label: string
  childTags: string[]
}

const GAME_TAGS = new Set(["DOS1", "DOS2", "DOS2-CO"])
const WEAPON_TAGS = new Set([
  "Weapon",
  "Axe",
  "Bow",
  "Crossbow",
  "Dagger",
  "Knife",
  "Mace",
  "One-Handed-Sword",
  "Spear",
  "Sword",
  "Two-Handed-Axe",
  "Two-Handed-Mace",
  "Two-Handed-Sword",
])
const ARMOR_TAGS = new Set(["Armor", "Boot-Armor", "Glove-Armor", "Helmet-Armor", "Lowerbody-Armor", "Upperbody-Armor"])
const MATERIAL_PATTERN = /Essence|Rune|Soul|Source|Bone|Skull|Bottle|Nails|Dust|Wool|Yarn|Antler|Claw|Doll/i

/** Sidebar groups in display order, each with the test that puts a tag into it; the last takes the rest. */
const TAG_GROUPS: [string, (tag: string) => boolean][] = [
  ["Kategorie", (tag) => tagHierarchy.isCategory(tag)],
  ["Broń i narzędzia", (tag) => WEAPON_TAGS.has(tag) || /Weapon|Cutting-Tool/i.test(tag)],
  ["Pancerze", (tag) => ARMOR_TAGS.has(tag) || /Armor|Shoes|Boots/i.test(tag)],
  ["Biżuteria", (tag) => ["Amulet", "Ring"].includes(tag) || /Trinket/i.test(tag)],
  ["Księgi i zwoje", (tag) => /(?:Skillbook|Scroll)(?:-|$)/i.test(tag)],
  [
    "Materiały i wytwarzanie",
    (tag) => ["Dye", "Gold-Object", "Poison-Source", "Skull"].includes(tag) || MATERIAL_PATTERN.test(tag),
  ],
  ["Jedzenie", (tag) => /Fish|Honey|Poison-or-Rotten-Eggs|Jellyroom/i.test(tag)],
  ["Pozostałe", () => true],
]

/** Most entries first; equal counts alphabetically. */
function byCount<T extends TagStat>(tags: T[]): T[] {
  return [...tags].sort((a, b) => b.count - a.count || (a.label ?? a.tag).localeCompare(b.label ?? b.tag, "pl"))
}

/** The sidebar's tag filters: categories, trait sections and the remaining tags in themed groups. */
export class TagSidebar {
  /** @param traitGroups the trait sections, in hierarchy order */
  constructor(private readonly traitGroups: TraitGroup[] = []) {}

  /** Trait sections of the sidebar, in hierarchy order, with every tag below each of them. */
  static traitGroups(): TraitGroup[] {
    return tagHierarchy.traitSections.map((section) => ({
      parentTag: section.tag,
      label: section.label?.trim() || section.tag,
      childTags: tagHierarchy.descendants(section.tag),
    }))
  }

  /** Tags that only mark the game a page belongs to. */
  static isGameTag(tag: string): boolean {
    return GAME_TAGS.has(tag)
  }

  /** The tags worth showing on an item: the most specific ones, without game markers. */
  static visibleTags(tags: string[]): string[] {
    return tags.filter(
      (tag) => !TagSidebar.isGameTag(tag) && !tags.some((other) => other !== tag && tagHierarchy.isWithin(other, tag)),
    )
  }

  /** Tags under their nearest listed ancestor, each level by entry count. */
  static nest(tags: TagStat[]): TagFilterNode[] {
    const nodes = new Map(tags.map((tag) => [tag.tag, { ...tag, children: [] as TagFilterNode[] }]))
    const roots: TagFilterNode[] = []
    for (const node of nodes.values()) {
      const parent = tagHierarchy.ancestors(node.tag).find((ancestor) => nodes.has(ancestor))
      if (parent) nodes.get(parent)!.children.push(node)
      else roots.push(node)
    }
    for (const node of nodes.values()) node.children = byCount(node.children)
    return byCount(roots)
  }

  /** Requirements grouped by skill: Crafting, Blacksmithing, then the rest. */
  static requirementGroups(requirements: TagStat[]): { label: string; items: TagStat[] }[] {
    const groups = [
      { label: "Crafting", items: [] as TagStat[], test: (tag: string) => /^Crafting\b/i.test(tag) },
      { label: "Blacksmithing", items: [] as TagStat[], test: (tag: string) => /^Blacksmithing\b/i.test(tag) },
      { label: "Inne", items: [] as TagStat[], test: () => true },
    ]
    for (const requirement of requirements) {
      const group = groups.find((entry) => entry.test(requirement.tag)) ?? groups[groups.length - 1]
      group.items.push(requirement)
    }
    return groups.filter((group) => group.items.length > 0)
  }

  /** The sections of these tag counts: categories, then trait sections, then the themed groups. */
  sections(tags: TagStat[]): TagSection[] {
    const claimed = new Set(this.traitGroups.flatMap((group) => [group.parentTag, ...group.childTags]))
    const traits = this.traitSections(new Map(tags.map((stat) => [stat.tag, stat])))
    const hidden = (tag: string) =>
      TagSidebar.isGameTag(tag) || tag === "Category" || claimed.has(tag) || tagHierarchy.isTrait(tag)
    const groups = new Map<string, TagStat[]>(TAG_GROUPS.map(([label]) => [label, []]))
    for (const stat of tags) {
      if (hidden(stat.tag)) continue
      const [label] = TAG_GROUPS.find(([, test]) => test(stat.tag))!
      groups.get(label)!.push(stat)
    }
    const result: TagSection[] = []
    for (const [label, groupTags] of groups) {
      if (groupTags.length === 0) continue
      const sorted = byCount(groupTags)
      result.push({ label, tags: label === "Kategorie" ? TagSidebar.nest(sorted) : sorted })
    }
    // Cechy zaraz po Kategorie.
    const categories = result.findIndex((group) => group.label === "Kategorie")
    result.splice(categories < 0 ? result.length : categories + 1, 0, ...traits)
    return result
  }

  /** Cechy → osobne sekcje w kolejności hierarchy (nie jedna alfabetyczna lista). */
  private traitSections(byTag: Map<string, TagStat>): TagSection[] {
    const sections: TagSection[] = []
    for (const group of this.traitGroups) {
      const parent = byTag.get(group.parentTag)
      const sectionTags: TagStat[] = parent ? [{ ...parent, label: "Wszystkie" }] : []
      for (const childTag of group.childTags) {
        const child = byTag.get(childTag)
        if (child) sectionTags.push(child)
      }
      if (sectionTags.length > 0) sections.push({ label: group.label, tags: TagSidebar.nest(sectionTags), flat: true })
    }
    return sections
  }
}
