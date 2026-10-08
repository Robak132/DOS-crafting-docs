import { ComponentChildren } from "preact"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { Element, Root, RootContent } from "hast"
import { toString } from "hast-util-to-string"
import { getCatalogData, OVERHAUL_SLUG } from "../recipeCatalog"
import { RecipeCatalog } from "../recipes"
import { RecipeTable } from "../RecipeTable"
import { FullSlug } from "../../util/path"
import style from "../styles/recipeTable.scss"

const Content: QuartzComponent = ({ fileData, tree, allFiles }: QuartzComponentProps) => {
  let content = htmlToJsx(fileData.filePath!, tree) as ComponentChildren
  if (fileData.frontmatter?.itemPage === true && tree.type === "root") {
    let catalog: RecipeCatalog | null = null
    let inserted = false
    const sectionCatalogs: Record<string, RecipeCatalog> = {
      DOS1: "dos1",
      DOS2: "dos2",
      "DOS2 – Crafting Overhaul": "dos2-overhaul",
      "DOS2 - Crafting Overhaul": "dos2-overhaul",
    }
    const countLinks = (node: RootContent | Element): number =>
      node.type === "element"
        ? (node.tagName === "a" ? 1 : 0) + node.children.reduce((sum, child) => sum + countLinks(child), 0)
        : 0
    content = (tree as Root).children.map((node) => {
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName)) {
        catalog = sectionCatalogs[toString(node).trim()] ?? null
        inserted = false
      }
      if (catalog && node.type === "element") {
        const recipes = getCatalogData(allFiles, catalog).recipes.filter(
          (recipe) => recipe.result.slug === fileData.slug,
        )
        if (recipes.length && node.tagName === "p" && countLinks(node) >= 2 && /[+=]/.test(toString(node))) {
          if (inserted) return null
          inserted = true
          const data = getCatalogData(allFiles, catalog)
          const labels = Object.fromEntries(data.tags.map((tag) => [tag.tag, tag.label ?? tag.tag]))
          return (
            <RecipeTable
              recipes={recipes}
              slug={fileData.slug! as FullSlug}
              labels={labels}
              catalogSlug={(catalog === "dos1" ? "receptury" : OVERHAUL_SLUG) as FullSlug}
            />
          )
        }
        if (inserted && node.tagName === "ul" && /^(Wymagania|Uwagi|Źródło):/.test(toString(node))) return null
      }
      return htmlToJsx(fileData.filePath!, { type: "root", children: [node] } as Root) as ComponentChildren
    })
  }
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  return <article class={classString}>{content}</article>
}
Content.css = style

export default (() => Content) satisfies QuartzComponentConstructor
