import { RecipeItemView } from "./RecipeItem"
import type { RecipeItem, RecipeRow } from "../domain/recipes"
import { FullSlug } from "../routing"
import { useIncremental } from "./useIncremental"
import { useMemo } from "preact/hooks"
import {
  groupRecipes,
  recipeColumnsForCatalog,
  recipeResultTags,
  tagLabel,
  visibleRecipeTags,
  type ItemCraftRole,
} from "../domain/recipeView"

type Props = {
  recipes: RecipeRow[]
  labels: Record<string, string>
  catalogSlug: FullSlug
  searchable?: boolean
  /** false dla DOS2 / Overhaul — brak wymagań craftingu. */
  showRequirements?: boolean
  /** Rola craftingu → lekki tint linku (dead/mid/end). */
  itemRoles?: Record<string, ItemCraftRole>
  /** Render this many result groups first and add more on scroll. */
  pageSize?: number
}

export function RecipeTable({
  recipes,
  labels,
  catalogSlug,
  searchable = false,
  showRequirements = true,
  itemRoles = {},
  pageSize,
}: Props) {
  const columns = recipeColumnsForCatalog(showRequirements)
  const grouped = useMemo(() => groupRecipes(recipes), [recipes])
  const groups = useIncremental(grouped, pageSize)
  const renderItem = (item: RecipeItem, opts?: { ingredient?: boolean }) => (
    <RecipeItemView
      item={item}
      catalogSlug={catalogSlug}
      ingredient={opts?.ingredient}
      searchable={searchable}
      itemRoles={itemRoles}
    />
  )
  const empty = <span class="recipe-empty">—</span>
  return (
    <div class="recipe-table-wrap" role="region" aria-label="Lista przedmiotów do craftingu" tabIndex={0}>
      <table class="recipe-table">
        <colgroup>
          {columns.map(({ key }) => (
            <col key={key} class={`recipe-col ${key}`} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map(({ key, label }) => (
              <th key={key} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody class="recipe-table-body">
          {groups.visible.map((group) =>
            group.variants.map((recipe, index) => (
              <tr
                key={`${group.key}|${recipe.id}#${index}`}
                data-recipe-id={group.result.slug ?? group.result.name}
                class={[
                  index === 0 ? "recipe-group-start" : "recipe-group-inner",
                  index === group.variants.length - 1 ? "recipe-group-end" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {index === 0 && (
                  <td class="recipe-cell result" rowSpan={group.variants.length}>
                    {group.results.length > 1 ? (
                      <ul class="recipe-ingredients recipe-products">
                        {group.results.map((item, index) => (
                          <li key={index}>{renderItem(item)}</li>
                        ))}
                      </ul>
                    ) : (
                      renderItem(group.result)
                    )}
                    {group.result.pool && (
                      <details class="recipe-pool">
                        <summary>Możliwe wyniki ({group.result.pool.length})</summary>
                        <ul class="recipe-ingredients recipe-pool-list">
                          {group.result.pool.map((item) => (
                            <li key={item.slug ?? item.name}>
                              {renderItem(item)}
                              {item.requirements && <span class="recipe-pool-level">{item.requirements}</span>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {recipe.transformsIngredient !== undefined &&
                      !group.result.groupId &&
                      !group.result.selectorTag && <p class="recipe-remarks">{recipe.notes}</p>}
                  </td>
                )}
                <td class="recipe-cell ingredients">
                  <ul class="recipe-ingredients">
                    {recipe.ingredients.map((item, index) => (
                      <li key={index}>{renderItem(item, { ingredient: true })}</li>
                    ))}
                  </ul>
                  {recipe.remarks?.trim() && <p class="recipe-remarks">{recipe.remarks}</p>}
                </td>
                {showRequirements && (
                  <td class="recipe-cell meta" data-label="Wymagania">
                    {recipe.requirements?.trim() ? recipe.requirements : empty}
                  </td>
                )}
                <td class="recipe-cell tags" data-label="Tagi">
                  <div class="recipe-row-tags">
                    {visibleRecipeTags(recipeResultTags(recipe)).map((tag) => (
                      <button key={tag} type="button" class="recipe-search-tag" data-filter-tag={tag}>
                        {tagLabel(tag, labels)}
                      </button>
                    ))}
                  </div>
                </td>
                <td class="recipe-cell meta" data-label="Źródło">
                  {recipe.source?.trim() ? recipe.source : empty}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      {groups.hidden > 0 && (
        <div ref={groups.sentinel} class="load-more">
          <button type="button" onClick={groups.showAll}>
            Pokaż wszystkie (jeszcze {groups.hidden})
          </button>
        </div>
      )}
    </div>
  )
}
