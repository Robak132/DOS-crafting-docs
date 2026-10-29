import hierarchy from "../../../data/recipeTagHierarchy.json"

/**
 * Tags are English leaf names ("Bows", "WET"); Polish is only their label. Their parents live only in
 * data/recipeTagHierarchy.json: "Category" holds the item categories, and every other root is a sidebar section of traits.
 */
type Node = { tag: string; label?: string; children?: Node[] }

const parents = new Map<string, string | undefined>()
const labels = new Map<string, string>()
const children = new Map<string, string[]>()
const order = new Map<string, number>()
const roots = (hierarchy as { hierarchy: Node[] }).hierarchy

const walk = (node: Node, parent?: string) => {
  parents.set(node.tag, parent)
  order.set(node.tag, order.size)
  if (node.label?.trim()) labels.set(node.tag, node.label.trim())
  children.set(
    node.tag,
    (node.children ?? []).map((child) => child.tag),
  )
  node.children?.forEach((child) => walk(child, node.tag))
}
roots.forEach((root) => walk(root))

/** Sidebar sections of traits: hierarchy roots that are not item categories. */
export const traitSections = roots.filter((root) => root.tag !== "Category")
const sectionRoots = new Set(traitSections.map((root) => root.tag))

export function isKnownTag(tag: string): boolean {
  return parents.has(tag)
}

/** Parents of a tag, nearest first, up to its hierarchy root. */
export function tagAncestors(tag: string): string[] {
  const result: string[] = []
  for (let parent = parents.get(tag); parent; parent = parents.get(parent)) result.push(parent)
  return result
}

/** A tag with the parents an item implicitly has: every ancestor except a trait section root. */
export function withImpliedParents(tags: string[]): string[] {
  return [...new Set(tags.flatMap((tag) => [tag, ...tagAncestors(tag).filter((parent) => !sectionRoots.has(parent))]))]
}

/** True when `tag` is `ancestor` or sits below it in the hierarchy. */
export function isTagWithin(tag: string, ancestor: string): boolean {
  return tag === ancestor || tagAncestors(tag).includes(ancestor)
}

export function isCategoryTag(tag: string): boolean {
  return isTagWithin(tag, "Category")
}

export function tagDescendants(tag: string): string[] {
  return (children.get(tag) ?? []).flatMap((child) => [child, ...tagDescendants(child)])
}

export function hierarchyLabel(tag: string): string | undefined {
  return labels.get(tag)
}

/** Position in the hierarchy file; unknown tags sort last. */
export function tagOrder(tag: string): number {
  return order.get(tag) ?? Number.MAX_SAFE_INTEGER
}
