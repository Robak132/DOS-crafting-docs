import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { getRecipeCatalog, OVERHAUL_SLUG } from "./recipeCatalog"
import { FullSlug, resolveRelative } from "../util/path"
import style from "./styles/recipeTable.scss"

export default (() => {
  const prettifyLabel = (value: string): string => value.replaceAll("-", " ")
  const getTagParts = (tag: string): string[] => tag.split("/").filter(Boolean)
  const formatHierarchyLabel = (tag: string): string => {
    const parts = getTagParts(tag)
    return prettifyLabel(parts[parts.length - 1] ?? tag)
  }
  const getTagConnector = (tag: string): string => {
    const depth = Math.max(0, getTagParts(tag).length - 1)
    return depth > 0 ? "↳ ".repeat(depth) : ""
  }
  const getTagDepth = (tag: string): number => Math.max(0, tag.split("/").filter(Boolean).length - 1)

  const RecipeTagSidebar: QuartzComponent = ({ allFiles, displayClass, fileData }: QuartzComponentProps) => {
    const { tags, requirements } = getRecipeCatalog(allFiles, fileData.slug)
    const isOverhaul = fileData.slug === OVERHAUL_SLUG
    const categoryPages = isOverhaul
      ? allFiles
          .filter(
            (file) =>
              file.frontmatter?.catalog === "dos2" &&
              file.frontmatter?.itemPage !== true &&
              file.slug !== OVERHAUL_SLUG,
          )
          .sort((a, b) => (a.frontmatter?.title ?? "").localeCompare(b.frontmatter?.title ?? "", "pl"))
      : []
    const categoryLabels = new Map(
      categoryPages.flatMap((file) =>
        (file.frontmatter?.tags ?? []).map((tag) => [tag, file.frontmatter?.title ?? tag] as const),
      ),
    )

    if (tags.length === 0) {
      return null
    }

    return (
      <div class={classNames(displayClass, "recipe-sidebar")}>
        <div class="recipe-sidebar-nav">
          <a
            class="internal recipe-nav-link"
            href={resolveRelative(fileData.slug! as FullSlug, "receptury" as FullSlug)}
            data-no-popover="true"
          >
            Receptury
          </a>
          <a
            class="internal recipe-nav-link"
            href={resolveRelative(fileData.slug! as FullSlug, OVERHAUL_SLUG as FullSlug)}
            data-no-popover="true"
          >
            DOS2 – Crafting Overhaul
          </a>
          <a
            class="internal recipe-nav-link"
            href={resolveRelative(fileData.slug! as FullSlug, "przedmioty" as FullSlug)}
            data-no-popover="true"
          >
            Przedmioty
          </a>
        </div>
        <details class="recipe-sidebar-filters" open>
          <summary>Filtry przepisów</summary>
          <div class="recipe-sidebar-content">
            <div class="recipe-active-filters top">
              <span class="recipe-filters-label"></span>
              <button type="button" class="recipe-reset-btn" style="display: none;">
                Resetuj
              </button>
            </div>
            {requirements.length > 0 && (
              <div class="recipe-sidebar-section">
                <div class="recipe-sidebar-header">
                  <h3>{isOverhaul ? "STANOWISKA" : "WYMAGANIA"}</h3>
                </div>
                <div class="recipe-tag-list requirements-list">
                  {requirements.map((req) => (
                    <button
                      type="button"
                      class="recipe-tag-button requirement-button"
                      data-requirement={req.tag}
                      data-state="neutral"
                    >
                      <span class="recipe-tag-name">{req.tag === "-" ? "Brak" : prettifyLabel(req.tag)}</span>
                      <span class="recipe-tag-count">({req.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div class="recipe-sidebar-header">
              <h3>{isOverhaul ? "KATEGORIE" : "TAGI"}</h3>
            </div>
            <div class="recipe-tag-list">
              {tags.map((tag) => (
                <button
                  type="button"
                  class="recipe-tag-button tag-hierarchy"
                  data-tag={tag.tag}
                  data-state="neutral"
                  style={`--tag-depth: ${getTagDepth(tag.tag)};`}
                >
                  <span class="recipe-tag-name">
                    <span class="recipe-tag-connector">{getTagConnector(tag.tag)}</span>
                    {prettifyLabel(categoryLabels.get(tag.tag) ?? tag.label ?? formatHierarchyLabel(tag.tag))}
                  </span>
                  <span class="recipe-tag-count">({tag.count})</span>
                </button>
              ))}
            </div>
          </div>
        </details>
        {categoryPages.length > 0 && (
          <details class="recipe-category-navigation">
            <summary>Przedmioty według kategorii</summary>
            <nav class="recipe-category-links" aria-label="Kategorie przedmiotów">
              {categoryPages.map((page) => (
                <a
                  class="internal"
                  href={resolveRelative(fileData.slug! as FullSlug, page.slug! as FullSlug)}
                  data-no-popover="true"
                >
                  {page.frontmatter?.title}
                </a>
              ))}
            </nav>
          </details>
        )}
      </div>
    )
  }

  RecipeTagSidebar.css = style

  return RecipeTagSidebar
}) satisfies QuartzComponentConstructor
