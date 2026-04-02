import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { buildRecipeData } from "./recipes"
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
    const { tags, requirements } = buildRecipeData(allFiles)

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
            href={resolveRelative(fileData.slug! as FullSlug, "przedmioty" as FullSlug)}
            data-no-popover="true"
          >
            Przedmioty
          </a>
        </div>
        <div class="recipe-active-filters top">
          <span class="recipe-filters-label"></span>
          <button type="button" class="recipe-reset-btn" style="display: none;">
            Resetuj
          </button>
        </div>
        {requirements.length > 0 && (
          <div class="recipe-sidebar-section">
            <div class="recipe-sidebar-header">
              <h3>WYMAGANIA</h3>
            </div>
            <div class="recipe-tag-list requirements-list">
              {requirements.map((req) => (
                <button
                  type="button"
                  class="recipe-tag-button requirement-button"
                  data-requirement={req.tag}
                  data-state="neutral"
                >
                  <span class="recipe-tag-name">
                    {req.tag === "-" ? "Brak" : prettifyLabel(req.tag)}
                  </span>
                  <span class="recipe-tag-count">({req.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div class="recipe-sidebar-header">
          <h3>TAGI</h3>
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
                {formatHierarchyLabel(tag.tag)}
              </span>
              <span class="recipe-tag-count">({tag.count})</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  RecipeTagSidebar.css = style

  return RecipeTagSidebar
}) satisfies QuartzComponentConstructor
