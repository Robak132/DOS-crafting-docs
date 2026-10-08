import fs from "fs"
import path from "path"
import { QuartzPluginData } from "../plugins/vfile"

export type RecipeItem = {
  name: string
  slug?: string
  tags: string[]
  selectorTag?: string
}

export type RecipeRow = {
  id: string
  ingredients: RecipeItem[]
  result: RecipeItem
  tags: string[]
  requirements: string
  notes: string
  source: string
}

export type TagStat = {
  tag: string
  count: number
  label?: string
}

export type RecipeData = {
  recipes: RecipeRow[]
  tags: TagStat[]
  requirements: TagStat[]
}

type TagHierarchyNode = {
  tag: string
  label?: string
  children?: TagHierarchyNode[]
}

type TagHierarchyIndex = {
  byLowerTag: Map<string, string>
  byLowerLabel: Map<string, Set<string>>
  labelByTag: Map<string, string>
  orderedTags: string[]
}

let cachedHierarchyIndex: TagHierarchyIndex | null = null

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function extractWikiTargets(line: string): string[] {
  const results: string[] = []
  const regex = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]|(#[\p{L}\p{N}_\/-]+(?:\s+\([^)]*\))?)/gu
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(line)) !== null) {
    const target = (match[3] ?? match[2] ?? match[1])?.trim()
    if (target) {
      results.push(target)
    }
  }
  return results
}

function stripFrontmatter(lines: string[]): string[] {
  if (lines.length === 0) return lines
  if (lines[0].trim() !== "---") return lines
  let idx = 1
  while (idx < lines.length && lines[idx].trim() !== "---") {
    idx += 1
  }
  return lines.slice(Math.min(idx + 1, lines.length))
}

function findFirstContentLine(contents: string): string | null {
  const lines = stripFrontmatter(contents.split(/\r?\n/))
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    return trimmed
  }
  return null
}

function findRecipeLines(contents: string): string[] {
  const lines = stripFrontmatter(contents.split(/\r?\n/))
  const result: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (!/[+=]/.test(trimmed)) continue
    if (extractWikiTargets(trimmed).length < 2) continue
    result.push(trimmed)
  }
  if (result.length > 0) return result
  const fallback = findFirstContentLine(contents)
  return fallback ? [fallback] : []
}

type ParsedRecipeLine = {
  line: string
  requirements: string
  notes: string
  source: string
  catalog: RecipeCatalog
}

export type RecipeCatalog = "dos1" | "dos2" | "dos2-overhaul"

function parseRecipeEntries(contents: string): ParsedRecipeLine[] {
  const lines = stripFrontmatter(contents.split(/\r?\n/))
  const entries: ParsedRecipeLine[] = []
  let current: ParsedRecipeLine | null = null
  let catalog: RecipeCatalog = "dos1"

  const pushCurrent = () => {
    if (current) {
      entries.push(current)
      current = null
    }
  }

  const metaRegex = /^- \*\*(Wymagania|Uwagi|Źródło):?\*\*:?\s*(.*)$/

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^#{1,6}\s+DOS(?:1|2)(?:\s*[–-]\s*Crafting Overhaul)?$/.test(line)) {
      pushCurrent()
      catalog = line.includes("Crafting Overhaul") ? "dos2-overhaul" : line.endsWith("DOS2") ? "dos2" : "dos1"
      continue
    }

    const isRecipe = /[+=]/.test(line) && extractWikiTargets(line).length >= 2
    if (isRecipe) {
      pushCurrent()
      current = { line, requirements: "", notes: "", source: "", catalog }
      continue
    }

    if (current) {
      const match = line.match(metaRegex)
      if (match) {
        const label = match[1]
        const value = match[2]?.trim() ?? ""
        if (label === "Wymagania") {
          current.requirements = current.requirements ? `${current.requirements}; ${value}` : value
        } else if (label === "Uwagi") {
          current.notes = current.notes ? `${current.notes}; ${value}` : value
        } else if (label === "Źródło") {
          current.source = current.source ? `${current.source}; ${value}` : value
        }
      }
    }
  }

  pushCurrent()
  if (entries.length > 0) return entries

  const fallbackLines = findRecipeLines(contents)
  return fallbackLines.map((line) => ({
    line,
    requirements: "",
    notes: "",
    source: "",
    catalog,
  }))
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.filter((tag) => tag && tag !== "index"))]
}

function addLabelIndex(map: Map<string, Set<string>>, label: string, tag: string): void {
  const normalized = normalizeKey(label)
  if (!normalized) return
  const existing = map.get(normalized)
  if (existing) {
    existing.add(tag)
    return
  }
  map.set(normalized, new Set([tag]))
}

function getTagHierarchyIndex(): TagHierarchyIndex {
  if (cachedHierarchyIndex) return cachedHierarchyIndex

  const byLowerTag = new Map<string, string>()
  const byLowerLabel = new Map<string, Set<string>>()
  const labelByTag = new Map<string, string>()
  const orderedTags: string[] = []
  const hierarchyPath = path.join(process.cwd(), "content", "recipeTagHierarchy.json")

  try {
    const raw = fs.readFileSync(hierarchyPath, "utf8")
    const parsed = JSON.parse(raw) as { hierarchy?: TagHierarchyNode[] }
    const roots = Array.isArray(parsed.hierarchy) ? parsed.hierarchy : []

    const walk = (node: TagHierarchyNode) => {
      const canonical = node.tag?.trim().replace(/^\/+|\/+$/g, "")
      if (!canonical) return

      byLowerTag.set(normalizeKey(canonical), canonical)
      addLabelIndex(byLowerLabel, node.label ?? "", canonical)
      addLabelIndex(byLowerLabel, canonical.split("/").at(-1) ?? "", canonical)
      if (node.label?.trim()) {
        labelByTag.set(canonical, node.label.trim())
      }
      orderedTags.push(canonical)

      const children = Array.isArray(node.children) ? node.children : []
      children.forEach(walk)
    }

    roots.forEach(walk)
  } catch {
    // Static hierarchy file is optional during development; fallback keeps existing tags unchanged.
  }

  cachedHierarchyIndex = { byLowerTag, byLowerLabel, labelByTag, orderedTags }
  return cachedHierarchyIndex
}

function pickBestTag(candidates: Set<string>): string | null {
  const values = [...candidates]
  if (values.length === 0) return null
  if (values.length === 1) return values[0]
  values.sort((a, b) => {
    const depthDiff = a.split("/").length - b.split("/").length
    if (depthDiff !== 0) return depthDiff
    return a.localeCompare(b)
  })
  return values[0] ?? null
}

function normalizeTagNamespace(tag: string): string {
  const clean = tag.trim().replace(/^\/+|\/+$/g, "")
  if (!clean) return clean
  const lower = normalizeKey(clean)
  const { byLowerTag, byLowerLabel } = getTagHierarchyIndex()

  const exact = byLowerTag.get(lower)
  if (exact) return exact

  const fromLabel = byLowerLabel.get(lower)
  const best = fromLabel ? pickBestTag(fromLabel) : null
  if (best) return best

  return clean
}

function expandHierarchicalTags(tags: string[]): string[] {
  const expanded = new Set<string>()
  tags.forEach((tag) => {
    const clean = normalizeTagNamespace(tag)
    if (!clean) return
    const segments = clean.split("/").filter(Boolean)
    for (let i = 1; i <= segments.length; i++) {
      expanded.add(segments.slice(0, i).join("/"))
    }
  })
  return [...expanded]
}

function requirementTokens(value: string): string[] {
  const tokens = value
    .split(";")
    .map((val) => val.trim())
    .filter(Boolean)
  return tokens.length > 0 ? tokens : ["-"]
}

export function buildRecipeData(allFiles: QuartzPluginData[], catalog: RecipeCatalog = "dos1"): RecipeData {
  const itemLookup = new Map<string, RecipeItem>()
  const itemTagsBySlug = new Map<string, string[]>()
  const displayByNormalizedTag = new Map<string, string>()
  const entriesByFile = new Map<string, ParsedRecipeLine[]>()
  allFiles.forEach((file) => {
    if (!file.filePath) return
    const contents = fs.readFileSync(file.filePath, "utf8")
    entriesByFile.set(file.filePath, parseRecipeEntries(contents))
  })

  allFiles.forEach((file) => {
    if (!file.slug) return

    const filePath = file.filePath
    const fallbackName = filePath ? path.parse(filePath).name : (file.slug.split("/").at(-1) ?? file.slug)
    const title = (file.frontmatter?.title as string | undefined) ?? fallbackName

    const selectorTags = new Set(
      (file.filePath ? (entriesByFile.get(file.filePath) ?? []) : [])
        .flatMap((entry) => extractWikiTargets(entry.line).filter((target) => target.startsWith("#")))
        .map((target) => normalizeKey(target.match(/^#([^\s]+)/)![1])),
    )
    const frontmatterTags = (Array.isArray(file.frontmatter?.tags) ? file.frontmatter?.tags : []).filter(
      (tag) => !selectorTags.has(normalizeKey(tag)),
    )

    frontmatterTags.forEach((rawTag) => {
      if (typeof rawTag !== "string") return
      const clean = rawTag.trim().replace(/^\/+|\/+$/g, "")
      if (!clean) return
      const normalizedFull = normalizeKey(clean)
      if (normalizedFull && !displayByNormalizedTag.has(normalizedFull)) {
        displayByNormalizedTag.set(normalizedFull, clean)
      }
      const leaf = clean.split("/").filter(Boolean).at(-1) ?? clean
      const normalizedLeaf = normalizeKey(leaf)
      if (normalizedLeaf && !displayByNormalizedTag.has(normalizedLeaf)) {
        displayByNormalizedTag.set(normalizedLeaf, leaf)
      }
    })

    const tags = uniqueTags(expandHierarchicalTags([...(frontmatterTags ?? [])]))

    itemTagsBySlug.set(file.slug, tags)

    const candidates = new Set<string>()
    candidates.add(title)
    candidates.add(fallbackName)
    const slugTail = file.slug.split("/").at(-1)
    if (slugTail) candidates.add(slugTail)
    const frontmatterAliases = Array.isArray(file.frontmatter?.aliases) ? file.frontmatter?.aliases : []
    frontmatterAliases.forEach((alias) => candidates.add(alias))

    candidates.forEach((candidate) => {
      const key = normalizeKey(candidate)
      if (!key) return
      itemLookup.set(key, { name: candidate, slug: file.slug, tags })
    })
  })

  const recipes: RecipeRow[] = []
  allFiles.forEach((file) => {
    if (!file.slug || !file.filePath) return

    const recipeEntries = (entriesByFile.get(file.filePath) ?? []).filter((entry) => entry.catalog === catalog)
    if (recipeEntries.length === 0) return

    const fileTitle = (file.frontmatter?.title as string | undefined) ?? path.parse(file.filePath).name
    const resultSlug = file.slug
    const resultTags = itemTagsBySlug.get(resultSlug) ?? []
    const resultItem: RecipeItem = {
      name: fileTitle,
      slug: resultSlug,
      tags: resultTags,
    }

    const normalizedResult = normalizeKey(fileTitle)

    recipeEntries.forEach((entry) => {
      const targets = extractWikiTargets(entry.line)
      if (targets.length < 2) return

      const hasExplicitResult = entry.line.includes("=") && targets.length >= 2
      const ingredientsTargets =
        hasExplicitResult && normalizeKey(targets.at(-1) ?? "") === normalizedResult ? targets.slice(0, -1) : targets

      const ingredients = ingredientsTargets.map((target) => {
        if (target.startsWith("#")) {
          const selectorTag = target.match(/^#([^\s]+)/)![1]
          return { name: target, selectorTag, tags: expandHierarchicalTags([selectorTag]) }
        }
        const lookup = itemLookup.get(normalizeKey(target))
        if (lookup) {
          return {
            name: target,
            slug: lookup.slug,
            tags: lookup.tags,
          }
        }
        return {
          name: target,
          tags: [],
        }
      })

      const gameTag = catalog === "dos1" ? "DOS1" : catalog === "dos2" ? "DOS2" : "DOS2-CO"
      const recipeTags = uniqueTags(
        expandHierarchicalTags(
          [...resultTags, ...ingredients.flatMap((ingredient) => ingredient.tags ?? [])]
            .filter((tag) => !["DOS1", "DOS2", "DOS2-CO"].includes(tag))
            .concat(gameTag),
        ),
      )

      const id = `${resultSlug}:${ingredientsTargets.join("+")}`
      recipes.push({
        id,
        ingredients,
        result: resultItem,
        tags: recipeTags,
        requirements: entry.requirements,
        notes: entry.notes,
        source: entry.source,
      })
    })
  })

  const collator = new Intl.Collator("pl", { sensitivity: "base", numeric: true })
  recipes.sort((a, b) => collator.compare(a.result.name, b.result.name))

  const tagCounts = new Map<string, number>()
  const requirementCounts = new Map<string, number>()
  recipes.forEach((recipe) => {
    recipe.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    })
    requirementTokens(recipe.requirements ?? "").forEach((token) => {
      requirementCounts.set(token, (requirementCounts.get(token) ?? 0) + 1)
    })
  })

  const hierarchyIndex = getTagHierarchyIndex()
  const hierarchyOrder = hierarchyIndex.orderedTags
  const hierarchyOrderIndex = new Map(hierarchyOrder.map((tag, index) => [tag, index]))
  const impliedAncestorOrder = new Map<string, number>()
  hierarchyOrder.forEach((tag, index) => {
    const segments = tag.split("/").filter(Boolean)
    for (let depth = 1; depth < segments.length; depth++) {
      const ancestor = segments.slice(0, depth).join("/")
      if (hierarchyOrderIndex.has(ancestor)) continue
      const existing = impliedAncestorOrder.get(ancestor)
      if (existing === undefined || index < existing) {
        impliedAncestorOrder.set(ancestor, index)
      }
    }
  })
  const getSortOrder = (tag: string): number => {
    const exact = hierarchyOrderIndex.get(tag)
    if (exact !== undefined) return exact * 2
    const implied = impliedAncestorOrder.get(tag)
    if (implied !== undefined) return implied * 2 - 1
    return Number.MAX_SAFE_INTEGER
  }
  const tagDepth = (tag: string): number => tag.split("/").filter(Boolean).length
  const tags: TagStat[] = [...tagCounts.entries()]
    .map(([tag, count]) => {
      const leaf = tag.split("/").filter(Boolean).at(-1) ?? tag
      const label =
        displayByNormalizedTag.get(normalizeKey(tag)) ??
        hierarchyIndex.labelByTag.get(tag) ??
        displayByNormalizedTag.get(normalizeKey(leaf)) ??
        leaf
      return { tag, count, label }
    })
    .sort((a, b) => {
      const orderA = getSortOrder(a.tag)
      const orderB = getSortOrder(b.tag)
      if (orderA !== orderB) return orderA - orderB
      const depthA = tagDepth(a.tag)
      const depthB = tagDepth(b.tag)
      if (depthA !== depthB) return depthA - depthB
      return a.tag.localeCompare(b.tag)
    })

  const requirements: TagStat[] = [...requirementCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag))

  return { recipes, tags, requirements }
}
