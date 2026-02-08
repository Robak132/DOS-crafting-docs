import { QuartzComponentProps } from "./types"
import { resolveRelative, slugifyFilePath } from "../util/path"

export default () => {
  return ({ fileData, allFiles, displayClass }: QuartzComponentProps) => {
    const backlinks = allFiles
      .filter((f) => (f.links ?? []).some((l) => slugifyFilePath(l as any) === fileData.slug))
      .map((f) => ({
        slug: f.slug!,
        title: f.frontmatter?.title ?? f.slug,
        tags: f.frontmatter?.tags ?? [],
      }))

    if (backlinks.length === 0) return null

    // Group backlinks by tag
    const grouped: Record<string, typeof backlinks> = {}
    for (const bl of backlinks) {
      const tags = bl.tags.length > 0 ? bl.tags : ["untagged"]
      for (const tag of tags) {
        if (!grouped[tag]) grouped[tag] = []
        grouped[tag].push(bl)
      }
    }

    // Sort tags alphabetically
    const sortedTags = Object.keys(grouped).sort((a, b) => a.localeCompare(b))

    return (
      <div className={displayClass ?? "backlinks"}>
        <h3 className="backlinks-title">Backlinks by Tag</h3>
        {sortedTags.map((tag) => (
          <details key={tag} className="tag-group">
            <summary className="tag-header">
              {tag} ({grouped[tag].length})
            </summary>
            <ul className="tag-links">
              {grouped[tag].map((bl) => (
                <li key={bl.slug}>
                  <a href={resolveRelative(fileData.slug!, bl.slug)}>{bl.title}</a>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    )
  }
}
