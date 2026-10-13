import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"

const ArticleTitle: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  if (fileData.frontmatter?.categoryPage === true) return null

  const title = fileData.frontmatter?.title
  if (!title) return null

  if (fileData.frontmatter?.itemPage === true) {
    const titlePl = fileData.frontmatter?.titlePl as string | undefined
    if (titlePl && titlePl !== title) {
      return (
        <h1 class={classNames(displayClass, "article-title")}>
          <span class="item-lang">
            <span class="item-lang-en">{title}</span>
            <span class="item-lang-pl">{titlePl}</span>
          </span>
        </h1>
      )
    }
    return <h1 class={classNames(displayClass, "article-title")}>{title}</h1>
  }

  return <h1 class={classNames(displayClass, "article-title")}>{title}</h1>
}

ArticleTitle.css = `
.article-title {
  margin: 2rem 0 0 0;
}
`

export default (() => ArticleTitle) satisfies QuartzComponentConstructor
