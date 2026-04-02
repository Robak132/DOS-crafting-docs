import { FullSlug, resolveRelative } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

// @ts-ignore
import style from "./styles/tagList.scss"

const TagList: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const tags = fileData.frontmatter?.tags
  const visibleTags = tags?.filter((tag) => tag !== "index")
  if (visibleTags && visibleTags.length > 0) {
    return (
      <ul class={classNames(displayClass, "tags")}>
        {visibleTags.map((tag) => {
          const filterPath = resolveRelative(fileData.slug!, "index" as FullSlug)
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
    )
  } else {
    return null
  }
}

TagList.css = style

export default (() => TagList) satisfies QuartzComponentConstructor
