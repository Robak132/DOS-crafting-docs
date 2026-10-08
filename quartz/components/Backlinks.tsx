import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/backlinks.scss"
import { FullSlug, resolveRelative, slugifyFilePath } from "../util/path"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
import OverflowListFactory from "./OverflowList"

interface BacklinksOptions {
  hideWhenEmpty: boolean
}

const defaultOptions: BacklinksOptions = {
  hideWhenEmpty: true,
}

export default ((opts?: Partial<BacklinksOptions>) => {
  const options: BacklinksOptions = { ...defaultOptions, ...opts }
  const { OverflowList, overflowListAfterDOMLoaded } = OverflowListFactory()
  const cache = new WeakMap<QuartzComponentProps["allFiles"], Map<string, QuartzComponentProps["allFiles"]>>()

  const getBacklinkIndex = (allFiles: QuartzComponentProps["allFiles"]) => {
    const cached = cache.get(allFiles)
    if (cached) return cached
    const index = new Map<string, QuartzComponentProps["allFiles"]>()
    allFiles.forEach((file) => {
      const targets = new Set((file.links ?? []).map((link) => slugifyFilePath(link as any)))
      targets.forEach((target) => {
        const sources = index.get(target) ?? []
        sources.push(file)
        index.set(target, sources)
      })
    })
    cache.set(allFiles, index)
    return index
  }

  const Backlinks: QuartzComponent = ({ fileData, allFiles, displayClass, cfg }: QuartzComponentProps) => {
    const backlinkFiles = (getBacklinkIndex(allFiles).get(fileData.slug!) ?? [])
      .map((file) => ({
        slug: file.slug! as FullSlug,
        title: (file.frontmatter?.title ?? file.slug ?? "Untitled") as string,
        tags: (file.frontmatter?.tags ?? []).filter((tag) => tag !== "index"),
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
    if (options.hideWhenEmpty && backlinkFiles.length == 0) {
      return null
    }
    const filterPath = resolveRelative(fileData.slug!, "index" as FullSlug)
    return (
      <div class={classNames(displayClass, "backlinks")}>
        <h3>{i18n(cfg.locale).components.backlinks.title}</h3>
        <OverflowList class="backlinks-list">
          {backlinkFiles.length > 0 ? (
            backlinkFiles.map((f) => (
              <li class="backlink-item">
                <a href={resolveRelative(fileData.slug!, f.slug)} class="internal">
                  {f.title}
                </a>
                {f.tags.length > 0 ? (
                  <ul class="tags backlinks-tags">
                    {f.tags.map((tag) => {
                      const linkDest = `${filterPath}?include=${encodeURIComponent(tag)}`
                      return (
                        <li>
                          <a href={linkDest} class="internal tag-link" data-no-popover="true" data-tag-filter={tag}>
                            {tag}
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            ))
          ) : (
            <li>{i18n(cfg.locale).components.backlinks.noBacklinksFound}</li>
          )}
        </OverflowList>
      </div>
    )
  }

  Backlinks.css = style
  Backlinks.afterDOMLoaded = overflowListAfterDOMLoaded

  return Backlinks
}) satisfies QuartzComponentConstructor
