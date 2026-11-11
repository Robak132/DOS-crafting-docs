import hierarchyFile from "../../../data/recipeTagHierarchy.json"

/** One entry of data/recipeTagHierarchy.json. */
export type TagNode = { tag: string; label?: string; children?: TagNode[] }

/**
 * Tags are English leaf names ("Bows", "WET"); Polish is only their label. Their parents live only in
 * data/recipeTagHierarchy.json: "Category" holds the item categories, and every other root is a sidebar section of traits.
 */
export class TagHierarchy {
  /** Sidebar sections of traits: hierarchy roots that are not item categories. */
  readonly traitSections: TagNode[]
  private readonly parents = new Map<string, string | undefined>()
  private readonly labels = new Map<string, string>()
  private readonly children = new Map<string, string[]>()
  private readonly order = new Map<string, number>()
  private readonly sectionRoots: Set<string>

  constructor(roots: TagNode[]) {
    roots.forEach((root) => this.add(root))
    this.traitSections = roots.filter((root) => root.tag !== "Category")
    this.sectionRoots = new Set(this.traitSections.map((root) => root.tag))
  }

  isKnown(tag: string): boolean {
    return this.parents.has(tag)
  }

  /** Parents of a tag, nearest first, up to its hierarchy root. */
  ancestors(tag: string): string[] {
    const result: string[] = []
    for (let parent = this.parents.get(tag); parent; parent = this.parents.get(parent)) result.push(parent)
    return result
  }

  /** Every tag below this one, depth first. */
  descendants(tag: string): string[] {
    return (this.children.get(tag) ?? []).flatMap((child) => [child, ...this.descendants(child)])
  }

  /** The tags with the parents an item implicitly has: every ancestor except a trait section root. */
  withImpliedParents(tags: string[]): string[] {
    return [
      ...new Set(
        tags.flatMap((tag) => [tag, ...this.ancestors(tag).filter((parent) => !this.sectionRoots.has(parent))]),
      ),
    ]
  }

  /** True when `tag` is `ancestor` or sits below it in the hierarchy. */
  isWithin(tag: string, ancestor: string): boolean {
    return tag === ancestor || this.ancestors(tag).includes(ancestor)
  }

  isCategory(tag: string): boolean {
    return this.isWithin(tag, "Category")
  }

  /**
   * The category that says most about an item: the deepest one, and on a tie anything before "Ingredients",
   * which a scroll or a potion also carries because recipes take it.
   */
  mainCategory(tags: string[]): string | undefined {
    const score = (tag: string) => this.ancestors(tag).length * 2 + (tag === "Ingredients" ? 0 : 1)
    return tags
      .filter((tag) => this.isCategory(tag))
      .reduce<string | undefined>(
        (best, tag) => (best === undefined || score(tag) > score(best) ? tag : best),
        undefined,
      )
  }

  /** A trait or effect tag: anything in the hierarchy outside the item categories. */
  isTrait(tag: string): boolean {
    return this.traitSections.some((section) => this.isWithin(tag, section.tag))
  }

  label(tag: string): string | undefined {
    return this.labels.get(tag)
  }

  /** Position in the hierarchy file; unknown tags sort last. */
  position(tag: string): number {
    return this.order.get(tag) ?? Number.MAX_SAFE_INTEGER
  }

  private add(node: TagNode, parent?: string) {
    this.parents.set(node.tag, parent)
    this.order.set(node.tag, this.order.size)
    if (node.label?.trim()) this.labels.set(node.tag, node.label.trim())
    this.children.set(
      node.tag,
      (node.children ?? []).map((child) => child.tag),
    )
    node.children?.forEach((child) => this.add(child, node.tag))
  }
}

export const tagHierarchy = new TagHierarchy((hierarchyFile as { hierarchy: TagNode[] }).hierarchy)
