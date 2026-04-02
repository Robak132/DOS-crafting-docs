import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { buildRecipeData } from "./recipes"
import style from "./styles/recipeTable.scss"

export default (() => {
  const RecipeTagSidebar: QuartzComponent = ({ allFiles, displayClass }: QuartzComponentProps) => {
    const { tags } = buildRecipeData(allFiles)

    if (tags.length === 0) {
      return null
    }

    return (
      <div class={classNames(displayClass, "recipe-sidebar")}>
        <div class="recipe-sidebar-header">
          <h3>TAGI</h3>
        </div>
        <div class="recipe-active-filters">
          <span class="recipe-filters-label"></span>
          <button type="button" class="recipe-reset-btn" style="display: none;">
            Resetuj
          </button>
        </div>
        <div class="recipe-tag-list">
          {tags.map((tag) => (
            <button
              type="button"
              class="recipe-tag-button"
              data-tag={tag.tag}
              data-state="neutral"
            >
              <span class="recipe-tag-name">{tag.tag}</span>
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
