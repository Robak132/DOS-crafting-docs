import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { FullSlug } from "../../util/path"
import { classNames } from "../../util/lang"
import style from "../styles/recipeTable.scss"
import { getRecipeCatalog, OVERHAUL_SLUG, DOS2_SLUG } from "../recipeCatalog"
import { RecipeTable } from "../RecipeTable"
import { groupRecipes } from "../recipeView"

// @ts-ignore
import script from "../scripts/recipeTable.inline"

export default (() => {
  const RecipeTablePage: QuartzComponent = ({ allFiles, fileData, displayClass }: QuartzComponentProps) => {
    const { recipes, tags } = getRecipeCatalog(allFiles, fileData.slug)
    const labels = Object.fromEntries(tags.map((tag) => [tag.tag, tag.label ?? tag.tag]))
    const slug = fileData.slug! as FullSlug
    return (
      <div
        class={classNames(displayClass, "recipe-app")}
        data-catalog={slug === OVERHAUL_SLUG ? "dos2" : slug === DOS2_SLUG ? "dos2-base" : "dos1"}
      >
        <script
          id="recipe-table-data"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ recipes, tags, labels }).replaceAll("<", "\\u003c"),
          }}
        />
        <div class="recipe-header">
          <span class="recipe-results-count" role="status" aria-live="polite">
            Wyników: {groupRecipes(recipes).length}
          </span>
          <div class="recipe-search">
            <label class="recipe-label" for="recipe-search-input">
              Szukaj
            </label>
            <input
              id="recipe-search-input"
              class="recipe-search-input"
              type="search"
              placeholder="Składnik, wynik lub #tag"
              autoComplete="off"
            />
          </div>
        </div>
        <RecipeTable recipes={recipes} slug={slug} labels={labels} catalogSlug={slug} searchable />
      </div>
    )
  }
  RecipeTablePage.css = style
  RecipeTablePage.afterDOMLoaded = script
  return RecipeTablePage
}) satisfies QuartzComponentConstructor
