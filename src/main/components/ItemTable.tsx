import { ItemIcon } from "./ItemIcon"
import type { RecipeRow } from "../domain/recipes"
import {
  catalogItemRows,
  groupCatalogByTags,
  itemCraftRoleClass,
  tagLabel,
  type ItemCraftRole,
} from "../domain/recipeView"

type Props = {
  recipes: RecipeRow[]
  labels: Record<string, string>
  itemHref: (slug: string) => string
  itemRoles?: Record<string, ItemCraftRole>
}

/** Shared by the generated page and the filtered browser view. */
export function ItemTable({ recipes, labels, itemHref, itemRoles = {} }: Props) {
  const sections = groupCatalogByTags(recipes, "recipes", labels)
  return (
    <div class="recipe-table-wrap" role="region" aria-label="Lista przedmiotów według kategorii" tabIndex={0}>
      <table class="recipe-table recipe-items-table">
        <colgroup>
          <col class="item-col-result" />
          <col class="item-col-effects" />
          <col class="item-col-tags" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Przedmiot</th>
            <th scope="col">Efekt</th>
            <th scope="col">Tagi</th>
          </tr>
        </thead>
        {sections.map((section) => (
          <tbody>
            <tr class="recipe-category-heading">
              <th colSpan={3} scope="rowgroup">
                {section.label}
              </th>
            </tr>
            {catalogItemRows(section.recipes).map(({ item, effects, tags }) => {
              const label = (
                <>
                  <ItemIcon icon={item.icon} />
                  <span class="item-lang">
                    <span class="item-lang-en">{item.name}</span>
                    <span class="item-lang-pl">{item.namePl ?? item.name}</span>
                  </span>
                </>
              )
              const role = itemCraftRoleClass(item.slug ? itemRoles[item.slug] : undefined)
              return (
                <tr class="recipe-group-start recipe-group-end">
                  <td class="recipe-cell result">
                    {item.slug ? (
                      <a class={`internal recipe-item ${role}`} href={itemHref(item.slug)} data-slug={item.slug}>
                        {label}
                      </a>
                    ) : (
                      <span class={`recipe-item ${role}`}>{label}</span>
                    )}
                  </td>
                  <td class="recipe-cell meta effects">
                    {effects.length > 0 ? (
                      <div class="recipe-effect-stack">
                        {effects.map((effect) => (
                          <button type="button" class="recipe-effect-chip" data-search-effect={effect}>
                            {effect}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span class="recipe-empty">—</span>
                    )}
                  </td>
                  <td class="recipe-cell tags">
                    {tags.length > 0 ? (
                      <div class="recipe-row-tags">
                        {tags.map((tag) => (
                          <button type="button" class="recipe-search-tag" data-search-tag={tag}>
                            {tagLabel(tag, labels)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span class="recipe-empty">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        ))}
        {sections.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={3} class="recipe-empty">
                Brak przedmiotów pasujących do filtrów.
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  )
}
