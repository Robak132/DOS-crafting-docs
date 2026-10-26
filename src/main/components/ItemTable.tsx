import { itemDataKey } from "../domain/itemIcons"
import { itemDescriptionText, type ItemDescription } from "./ItemTooltip"
import { ItemIcon } from "./ItemIcon"
import type { RecipeRow } from "../domain/recipes"
import { catalogItemRows, itemCraftRoleClass, tagLabel, type ItemCraftRole } from "../domain/recipeView"
import { useIncremental } from "./useIncremental"
import { useMemo } from "preact/hooks"

type Props = {
  recipes: RecipeRow[]
  labels: Record<string, string>
  itemHref: (slug: string) => string
  itemRoles?: Record<string, ItemCraftRole>
  descriptions?: Record<string, ItemDescription>
  lang?: "pl" | "en"
  /** Render this many rows first and add more on scroll. */
  pageSize?: number
}

/** Shared by the generated page and the filtered browser view. */
export function ItemTable({
  recipes,
  labels,
  itemHref,
  itemRoles = {},
  descriptions = {},
  lang = "en",
  pageSize,
}: Readonly<Props>) {
  const rows = useMemo(() => catalogItemRows(recipes, lang), [recipes, lang])
  const shown = useIncremental(rows, pageSize)
  // A column with no effect in any row would only repeat "—".
  const showEffects = rows.some((row) => row.effects.length > 0)
  if (rows.length === 0) {
    return <p class="recipe-empty">Brak przedmiotów pasujących do filtrów.</p>
  }
  return (
    <div class="recipe-table-wrap" role="region" aria-label="Lista przedmiotów" tabIndex={0}>
      <table class={`recipe-table recipe-items-table${showEffects ? "" : " no-effects"}`}>
        <colgroup>
          <col class="item-col-result" />
          {showEffects && <col class="item-col-effects" />}
          <col class="item-col-tags" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Przedmiot</th>
            {showEffects && <th scope="col">Efekt</th>}
            <th scope="col">Tagi</th>
          </tr>
        </thead>
        <tbody class="recipe-table-body">
          {shown.visible.map(({ item, effects, tags }) => {
            const description = itemDescriptionText(descriptions[itemDataKey(item)], lang)
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
              <tr key={item.slug ?? item.name} class="recipe-group-start recipe-group-end">
                <td class="recipe-cell result">
                  {item.slug ? (
                    <a class={`internal recipe-item ${role}`} href={itemHref(item.slug)} data-slug={item.slug}>
                      {label}
                    </a>
                  ) : (
                    <span class={`recipe-item ${role}`}>{label}</span>
                  )}
                  {description && <p class="item-list-description">{description}</p>}
                </td>
                {showEffects && (
                  <td class="recipe-cell meta effects" data-label="Efekt">
                    {effects.length > 0 ? (
                      <div class="recipe-effect-stack">
                        {effects.map((effect) => (
                          <button key={effect} type="button" class="recipe-effect-chip" data-search-effect={effect}>
                            {effect}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span class="recipe-empty">—</span>
                    )}
                  </td>
                )}
                <td class="recipe-cell tags" data-label="Tagi">
                  {tags.length > 0 ? (
                    <div class="recipe-row-tags">
                      {tags.map((tag) => (
                        <button key={tag} type="button" class="recipe-search-tag" data-filter-tag={tag}>
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
      </table>
      {shown.hidden > 0 && (
        <div ref={shown.sentinel} class="load-more">
          <button type="button" onClick={shown.showAll}>
            Pokaż wszystkie (jeszcze {shown.hidden})
          </button>
        </div>
      )}
    </div>
  )
}
