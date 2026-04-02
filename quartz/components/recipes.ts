import fs from "fs"
import path from "path"
import { QuartzPluginData } from "../plugins/vfile"

export type RecipeItem = {
  name: string
  slug?: string
  tags: string[]
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
}

export type RecipeData = {
  recipes: RecipeRow[]
  tags: TagStat[]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function extractWikiTargets(line: string): string[] {
  const results: string[] = []
  const regex = /\[\[([^\]|#]+)(?:[^\]]*)\]\]/g
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(line)) !== null) {
    const target = match[1]?.trim()
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
    if (!trimmed.includes("[[")) continue
    if (!trimmed.includes("]]")) continue
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
}

function parseRecipeEntries(contents: string): ParsedRecipeLine[] {
  const lines = stripFrontmatter(contents.split(/\r?\n/))
  const entries: ParsedRecipeLine[] = []
  let current: ParsedRecipeLine | null = null

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

    const isRecipe = line.includes("[[") && line.includes("]]") && extractWikiTargets(line).length >= 2
    if (isRecipe) {
      pushCurrent()
      current = { line, requirements: "", notes: "", source: "" }
      continue
    }

    if (current) {
      const match = line.match(metaRegex)
      if (match) {
        const label = match[1]
        const value = match[2]?.trim() ?? ""
        if (label === "Wymagania") {
          current.requirements = current.requirements
            ? `${current.requirements}; ${value}`
            : value
        } else if (label === "Uwagi") {
          current.notes = current.notes
            ? `${current.notes}; ${value}`
            : value
        } else if (label === "Źródło") {
          current.source = current.source
            ? `${current.source}; ${value}`
            : value
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
  }))
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.filter((tag) => tag && tag !== "index"))]
}

export function buildRecipeData(allFiles: QuartzPluginData[]): RecipeData {
  const itemLookup = new Map<string, RecipeItem>()
  const itemTagsBySlug = new Map<string, string[]>()

  allFiles.forEach((file) => {
    if (!file.slug) return

    const filePath = file.filePath
    const fallbackName = filePath ? path.parse(filePath).name : file.slug.split("/").at(-1) ?? file.slug
    const title = (file.frontmatter?.title as string | undefined) ?? fallbackName

    const frontmatterTags = Array.isArray(file.frontmatter?.tags) ? file.frontmatter?.tags : []
    const tags = uniqueTags([...(frontmatterTags ?? [])])

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

    let contents = ""
    try {
      contents = fs.readFileSync(file.filePath, "utf8")
    } catch {
      return
    }

    const recipeEntries = parseRecipeEntries(contents)
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

      const hasExplicitResult = entry.line.includes("=") && targets.length >= 3
      const ingredientsTargets =
        hasExplicitResult && normalizeKey(targets.at(-1) ?? "") === normalizedResult
          ? targets.slice(0, -1)
          : targets

      const ingredients = ingredientsTargets.map((target) => {
        const lookup = itemLookup.get(normalizeKey(target))
        if (lookup) {
          return {
            name: lookup.name,
            slug: lookup.slug,
            tags: lookup.tags,
          }
        }
        return {
          name: target,
          tags: [],
        }
      })

      const recipeTags = uniqueTags([
        ...resultTags,
        ...ingredients.flatMap((ingredient) => ingredient.tags ?? []),
      ])

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
  recipes.forEach((recipe) => {
    recipe.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    })
  })
  const tags: TagStat[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))

  return { recipes, tags }
}
