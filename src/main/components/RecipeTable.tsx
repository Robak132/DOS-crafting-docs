import { RecipeItemView } from "./RecipeItem"
import type { ItemCraftRole } from "../domain/craftRoles"
import { Item } from "../domain/item"
import type { Recipe } from "../domain/recipe"
import { recipeColumns, ResultGroup } from "../domain/resultGroup"
import type { TagLabels } from "../domain/tagLabels"
import { TagSidebar } from "../domain/tagSidebar"
import { useIncremental } from "./useIncremental"
import { useMemo } from "preact/hooks"

type Props = {
  recipes: Recipe[]
  labels: TagLabels
  catalogSlug: string
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
}: Readonly<Props>) {
  const columns = recipeColumns(showRequirements)
  const grouped = useMemo(() => ResultGroup.of(recipes), [recipes])
  const groups = useIncremental(grouped, pageSize)
  const renderItem = (item: Item, opts?: { ingredient?: boolean }) => (
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
    <section class="recipe-table-wrap" aria-label="Lista przedmiotów do craftingu">
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
                        {Item.keyed(group.results).map(([key, item]) => (
                          <li key={key}>{renderItem(item)}</li>
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
                    {Item.keyed(recipe.ingredients).map(([key, item]) => (
                      <li key={key}>{renderItem(item, { ingredient: true })}</li>
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
                    {TagSidebar.visibleTags(recipe.resultTags()).map((tag) => (
                      <button key={tag} type="button" class="recipe-search-tag" data-filter-tag={tag}>
                        {labels.label(tag)}
                      </button>
                    ))}
                  </div>
                </td>
                <td class="recipe-cell meta" data-label="Źródło">
                  {recipe.source?.trim() ? (
                    <span class="item-lang">
                      <span class="item-lang-en">{recipe.sourceText("en")}</span>
                      <span class="item-lang-pl">{recipe.sourceText("pl")}</span>
                    </span>
                  ) : (
                    empty
                  )}
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
    </section>
  )
}
