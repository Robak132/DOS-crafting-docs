import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import { FullSlug, resolveRelative } from "../../util/path"
import { classNames } from "../../util/lang"
import style from "../styles/recipeTable.scss"
import { RecipeItem, RecipeRow } from "../recipes"
import { getRecipeCatalog, OVERHAUL_SLUG } from "../recipeCatalog"
import { RecipeNavigation } from "../RecipeNavigation"

// @ts-ignore
import script from "../scripts/recipeTable.inline"

export default (() => {
  const RecipeTablePage: QuartzComponent = ({ allFiles, fileData, displayClass }: QuartzComponentProps) => {
    const { recipes, tags } = getRecipeCatalog(allFiles, fileData.slug)
    const isOverhaul = fileData.slug === OVERHAUL_SLUG

    const grouped = new Map<string, { result: RecipeItem; variants: RecipeRow[] }>()
    recipes.forEach((recipe) => {
      const key = recipe.result.slug ?? recipe.result.name
      const existing = grouped.get(key)
      if (existing) {
        existing.variants.push(recipe)
      } else {
        grouped.set(key, { result: recipe.result, variants: [recipe] })
      }
    })

    const renderItem = (item: RecipeItem) => {
      if (!item.slug) {
        return <span class="recipe-item">{item.name}</span>
      }
      return (
        <a class="internal recipe-item" href={resolveRelative(fileData.slug! as FullSlug, item.slug as FullSlug)}>
          {item.name}
        </a>
      )
    }

    return (
      <div class={classNames(displayClass, "recipe-app")} data-catalog={isOverhaul ? "dos2" : "dos1"}>
        <RecipeNavigation slug={fileData.slug! as FullSlug} />
        <script
          id="recipe-table-data"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              recipes,
              tags,
            }).replaceAll("<", "\\u003c"),
          }}
        />
        <div class="recipe-header">
          <span class="recipe-results-count" role="status" aria-live="polite">
            Wyników: {grouped.size}
          </span>
          <div class="recipe-search">
            <label class="recipe-label" for="recipe-search-input">
              Szukaj
            </label>
            <input
              id="recipe-search-input"
              class="recipe-search-input"
              type="search"
              placeholder="Szukaj po składniku, wyniku lub tagu"
              autoComplete="off"
            />
          </div>
        </div>
        <div class="recipe-table-wrap">
          <table class="recipe-table">
            <colgroup>
              <col class="recipe-col ingredient-one" />
              <col class="recipe-col ingredient-two" />
              <col class="recipe-col result" />
              <col class="recipe-col requirements" />
              <col class="recipe-col notes" />
            </colgroup>
            <thead>
              <tr>
                <th>Składnik 1</th>
                <th>{isOverhaul ? "Pozostałe składniki" : "Składnik 2"}</th>
                <th>Wynik</th>
                <th>{isOverhaul ? "Stanowisko" : "Wymagania"}</th>
                <th>{isOverhaul ? "Uwagi / efekty" : "Uwagi"}</th>
              </tr>
            </thead>
            <tbody class="recipe-table-body">
              {[...grouped.values()].map((group) =>
                group.variants.map((variant, index) => (
                  <tr
                    data-recipe-id={group.result.slug ?? group.result.name}
                    class={[
                      index === 0 ? "recipe-group-start" : "recipe-group-inner",
                      index === group.variants.length - 1 ? "recipe-group-end" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <td class="recipe-cell">
                      {variant.ingredients[0] ? (
                        renderItem(variant.ingredients[0])
                      ) : (
                        <span class="recipe-empty">—</span>
                      )}
                    </td>
                    <td class="recipe-cell">
                      {isOverhaul ? (
                        <div class="recipe-ingredients">
                          {variant.ingredients.length > 1 ? (
                            variant.ingredients.slice(1).map(renderItem)
                          ) : (
                            <span class="recipe-empty">—</span>
                          )}
                        </div>
                      ) : variant.ingredients[1] ? (
                        renderItem(variant.ingredients[1])
                      ) : (
                        <span class="recipe-empty">—</span>
                      )}
                      {!isOverhaul && variant.ingredients.length > 2 && (
                        <span class="recipe-extra">+{variant.ingredients.length - 2}</span>
                      )}
                    </td>
                    {index === 0 && (
                      <td class="recipe-cell result" rowSpan={group.variants.length}>
                        {renderItem(group.result)}
                      </td>
                    )}
                    <td class="recipe-cell meta">
                      {variant.requirements ? variant.requirements : <span class="recipe-empty">—</span>}
                    </td>
                    <td class="recipe-cell meta">
                      {variant.notes ? variant.notes : <span class="recipe-empty">—</span>}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  RecipeTablePage.css = style
  RecipeTablePage.afterDOMLoaded = script

  return RecipeTablePage
}) satisfies QuartzComponentConstructor
