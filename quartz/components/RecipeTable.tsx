import type { RecipeItem, RecipeRow } from "./recipes"
import { FullSlug, resolveRelative } from "../util/path"
import { groupRecipes, recipeColumns, tagLabel, visibleRecipeTags } from "./recipeView"

type Props = {
  recipes: RecipeRow[]
  slug: FullSlug
  labels: Record<string, string>
  catalogSlug: FullSlug
  searchable?: boolean
}

export function RecipeTable({ recipes, slug, labels, catalogSlug, searchable = false }: Props) {
  const renderItem = (item: RecipeItem) =>
    item.selectorTag ? (
      searchable ? (
        <button type="button" class="recipe-item recipe-ingredient-tag" data-search-tag={item.selectorTag}>
          {item.name}
        </button>
      ) : (
        <a
          class="internal recipe-item recipe-ingredient-tag"
          data-no-popover="true"
          href={`${resolveRelative(slug, catalogSlug)}?tag=${encodeURIComponent(item.selectorTag)}`}
        >
          {item.name}
        </a>
      )
    ) : item.slug ? (
      <a class="internal recipe-item" href={resolveRelative(slug, item.slug as FullSlug)}>
        {item.name}
      </a>
    ) : (
      <span class="recipe-item">{item.name}</span>
    )
  const empty = <span class="recipe-empty">—</span>
  return (
    <div class="recipe-table-wrap" role="region" aria-label="Tabela przepisów" tabIndex={0}>
      <table class="recipe-table">
        <colgroup>
          {recipeColumns.map(({ key }) => (
            <col class={`recipe-col ${key}`} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {recipeColumns.map(({ label }) => (
              <th scope="col">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody class="recipe-table-body">
          {groupRecipes(recipes).map((group) =>
            group.variants.map((recipe, index) => (
              <tr
                data-recipe-id={group.result.slug ?? group.result.name}
                class={[
                  index === 0 ? "recipe-group-start" : "recipe-group-inner",
                  index === group.variants.length - 1 ? "recipe-group-end" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <td class="recipe-cell ingredients">
                  <ul class="recipe-ingredients">
                    {recipe.ingredients.map((item) => (
                      <li>{renderItem(item)}</li>
                    ))}
                  </ul>
                </td>
                {index === 0 && (
                  <td class="recipe-cell result" rowSpan={group.variants.length}>
                    {renderItem(group.result)}
                  </td>
                )}
                <td class="recipe-cell meta">{recipe.requirements || empty}</td>
                <td class="recipe-cell meta">{recipe.notes || empty}</td>
                <td class="recipe-cell tags">
                  <div class="recipe-row-tags">
                    {visibleRecipeTags(recipe.tags).map((tag) =>
                      searchable ? (
                        <button type="button" class="recipe-search-tag" data-search-tag={tag}>
                          {tagLabel(tag, labels)}
                        </button>
                      ) : (
                        <a
                          class="internal recipe-search-tag"
                          data-no-popover="true"
                          href={`${resolveRelative(slug, catalogSlug)}?tag=${encodeURIComponent(tag)}`}
                        >
                          {tagLabel(tag, labels)}
                        </a>
                      ),
                    )}
                  </div>
                </td>
                <td class="recipe-cell meta source">{recipe.source || empty}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}
