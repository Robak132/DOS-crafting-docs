import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import style from "../styles/listPage.scss"
import { getAllSegmentPrefixes } from "../../util/path"

// @ts-ignore
import script from "../scripts/filteredTag.inline"

export default (() => {
  const FilteredTagContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { allFiles } = props
    const filesData = allFiles.map((file) => ({
      slug: file.slug,
      title: file.frontmatter?.title ?? file.slug,
      tags: (file.frontmatter?.tags ?? []).filter((tag) => tag !== "index"),
      matchTags: (file.frontmatter?.tags ?? []).flatMap(getAllSegmentPrefixes),
    }))

    return (
      <div class="filtered-tag-content">
        <script
          id="filtered-tag-data"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ files: filesData }),
          }}
        />
        <article class="popover-hint">
          <div id="filtered-content-container">
            <ul class="filtered-pages-list"></ul>
          </div>
        </article>
      </div>
    )
  }

  FilteredTagContent.css = style
  FilteredTagContent.afterDOMLoaded = script

  return FilteredTagContent
}) satisfies QuartzComponentConstructor

