import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/tagExplorer.scss"
import { getAllSegmentPrefixes, resolveRelative } from "../util/path"
import { classNames } from "../util/lang"
import { RecipeNavigation } from "./RecipeNavigation"

// @ts-ignore
import script from "./scripts/tagExplorer.inline"

interface TagExplorerOptions {
  title: string
  hideWhenEmpty: boolean
}

const defaultOptions: TagExplorerOptions = {
  title: "TAGI",
  hideWhenEmpty: false,
}

export default ((opts?: Partial<TagExplorerOptions>) => {
  const options: TagExplorerOptions = { ...defaultOptions, ...opts }
  type ExplorerData = {
    sortedTagsByCount: string[]
    tagCounts: Map<string, number>
    indexPages: QuartzComponentProps["allFiles"]
  }
  const cache = new WeakMap<QuartzComponentProps["allFiles"], ExplorerData>()

  const getExplorerData = (allFiles: QuartzComponentProps["allFiles"]): ExplorerData => {
    const cached = cache.get(allFiles)
    if (cached) return cached
    const tagCounts = new Map<string, number>()
    allFiles.forEach((file) => {
      const tags = file.frontmatter?.tags ?? []
      new Set(tags.flatMap(getAllSegmentPrefixes)).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      })
    })

    // Sort tags by count (descending), then alphabetically
    const sortedTagsByCount = [...tagCounts.keys()].sort((a, b) => {
      const countA = tagCounts.get(a) ?? 0
      const countB = tagCounts.get(b) ?? 0
      if (countB !== countA) {
        return countB - countA // Descending by count
      }
      return a.localeCompare(b) // Alphabetically
    })

    const indexPages = allFiles
      .filter((file) => (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes).includes("index"))
      .toSorted((a, b) => {
        const aTitle = a.frontmatter?.title?.toLowerCase() ?? ""
        const bTitle = b.frontmatter?.title?.toLowerCase() ?? ""
        return aTitle.localeCompare(bTitle)
      })

    const data = { sortedTagsByCount, tagCounts, indexPages }
    cache.set(allFiles, data)
    return data
  }

  const TagExplorer: QuartzComponent = ({ allFiles, displayClass, fileData }: QuartzComponentProps) => {
    const { sortedTagsByCount, tagCounts, indexPages } = getExplorerData(allFiles)

    if (options.hideWhenEmpty && sortedTagsByCount.length === 0) {
      return null
    }

    return (
      <div class={classNames(displayClass, "tag-explorer")}>
        <RecipeNavigation slug={fileData.slug!} />
        {indexPages.length > 0 && (
          <div class="index-links">
            <ul class="index-links-list">
              {indexPages.map((page) => (
                <li>
                  <a
                    class="internal index-link"
                    href={resolveRelative(fileData.slug!, page.slug!)}
                    data-no-popover="true"
                  >
                    {page.frontmatter?.title ?? page.slug}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div class="tag-explorer-header">
          <h3>{options.title}</h3>
        </div>
        <div class="active-filters">
          <span class="filters-label"></span>
          <button type="button" class="reset-filters-btn" style="display: none;">
            Resetuj
          </button>
        </div>
        <ul id="tag-explorer-content" class="tag-list overflow">
          {sortedTagsByCount.map((tag) => {
            const count = tagCounts.get(tag) ?? 0
            return (
              <li>
                <button type="button" class="tag-button" data-tag={tag} data-state="neutral">
                  {tag}
                </button>
                <span class="tag-count">({count})</span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  TagExplorer.css = style
  TagExplorer.afterDOMLoaded = script

  return TagExplorer
}) satisfies QuartzComponentConstructor
