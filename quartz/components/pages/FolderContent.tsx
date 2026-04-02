import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"

import style from "../styles/listPage.scss"
import { Root } from "hast"
import { htmlToJsx } from "../../util/jsx"
import { ComponentChildren } from "preact"

export default (() => {
  const FolderContent: QuartzComponent = (props: QuartzComponentProps) => {
    const { tree, fileData } = props

    const cssClasses: string[] = fileData.frontmatter?.cssclasses ?? []
    const classes = cssClasses.join(" ")

    const content = (
      (tree as Root).children.length === 0
        ? fileData.description
        : htmlToJsx(fileData.filePath!, tree)
    ) as ComponentChildren

    return (
      <div class="folder-content">
        <article class={classes}>{content}</article>
      </div>
    )
  }

  FolderContent.css = style
  return FolderContent
}) satisfies QuartzComponentConstructor
