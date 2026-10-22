import type { ComponentChild } from "preact"
import { ItemIcon } from "./ItemIcon"
import { tooltipItemKey } from "../domain/tooltipIdentity"
import type { RecipeItem, RecipeRow } from "../domain/recipes"
import { formatItemQuantity } from "../domain/recipeQuantity"
import { FullSlug, gameForSlug, pageHref } from "../routing"
import {
  groupRecipes,
  itemCraftRoleClass,
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
}

function itemAltTitle(item: RecipeItem): string | undefined {
  if (item.namePl && item.namePl !== item.name) return item.namePl
  return undefined
}

function ItemLabel({ item }: { item: RecipeItem }) {
  if (item.namePl && item.namePl !== item.name) {
    return (
      <span class="item-lang">
        <span class="item-lang-en">{item.name}</span>
        <span class="item-lang-pl">{item.namePl}</span>
      </span>
    )
  }
  return <span class="item-lang">{item.name}</span>
}

export function RecipeTable({
  recipes,
  labels,
  catalogSlug,
  searchable = false,
  showRequirements = true,
  itemRoles = {},
}: Props) {
  const columns = recipeColumnsForCatalog(showRequirements)
  const withQuantity = (node: ComponentChild, item: RecipeItem) => {
    const qty = formatItemQuantity(item.quantity)
    if (!qty) return node
    return (
      <span class="recipe-item-wrap">
        {node}
        <span class="recipe-item-qty"> {qty}</span>
      </span>
    )
  }
  const roleClass = (item: RecipeItem) => itemCraftRoleClass(item.slug ? itemRoles[item.slug] : undefined)
  const renderItem = (item: RecipeItem, opts?: { ingredient?: boolean }) => {
    const title = itemAltTitle(item)
    const searchText = item.name.replace(/^#/, "").replace(/^<|>$/g, "")
    const craftClass = roleClass(item)
    if (item.groupId && (item.groupSize ?? 0) >= 4) {
      return withQuantity(
        <a
          class="internal recipe-item recipe-item-group"
          data-no-popover="true"
          href={`${pageHref(catalogSlug)}?view=items&group=${encodeURIComponent(item.groupId)}`}
        >
          <ItemLabel item={item} />
          <span class="group-count">{item.groupSize}</span>
        </a>,
        item,
      )
    }
    if (item.selectorTag) {
      return withQuantity(
        searchable ? (
          <button
            type="button"
            class={["recipe-item", "recipe-ingredient-tag", craftClass].filter(Boolean).join(" ")}
            data-search-text={searchText}
            title={title}
          >
            <ItemIcon icon={item.icon} />
            <ItemLabel item={item} />
          </button>
        ) : (
          <a
            class={["internal", "recipe-item", "recipe-ingredient-tag", craftClass].filter(Boolean).join(" ")}
            data-no-popover="true"
            href={`${pageHref(catalogSlug)}?as=ingredient&q=${encodeURIComponent(searchText)}`}
            title={title}
          >
            <ItemIcon icon={item.icon} />
            <ItemLabel item={item} />
          </a>
        ),
        item,
      )
    }
    if (item.slug) {
      return withQuantity(
        <a
          class={["internal", "recipe-item", craftClass].filter(Boolean).join(" ")}
          data-slug={item.slug}
          data-tooltip-key={tooltipItemKey(item)}
          href={`${pageHref(item.slug)}?catalog=${gameForSlug(catalogSlug) ?? "dos1"}`}
          title={title}
        >
          <ItemIcon icon={item.icon} />
          <ItemLabel item={item} />
        </a>,
        item,
      )
    }
    if (opts?.ingredient && searchable) {
      return withQuantity(
        <button
          type="button"
          class={["recipe-item", "recipe-ingredient-tag", craftClass].filter(Boolean).join(" ")}
          data-search-text={item.name}
          data-tooltip-key={tooltipItemKey(item)}
          title={title}
        >
          <ItemIcon icon={item.icon} />
          <ItemLabel item={item} />
        </button>,
        item,
      )
    }
    if (opts?.ingredient) {
      return withQuantity(
        <a
          class={["internal", "recipe-item", "recipe-ingredient-tag", craftClass].filter(Boolean).join(" ")}
          data-no-popover="true"
          href={`${pageHref(catalogSlug)}?as=ingredient&q=${encodeURIComponent(item.name)}`}
          title={title}
        >
          <ItemIcon icon={item.icon} />
          <ItemLabel item={item} />
        </a>,
        item,
      )
    }
    return withQuantity(
      <span
        class={["recipe-item", craftClass].filter(Boolean).join(" ")}
        title={title}
        data-tooltip-key={tooltipItemKey(item)}
      >
        <ItemIcon icon={item.icon} />
        <ItemLabel item={item} />
      </span>,
      item,
    )
  }
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
          {groupRecipes(recipes).map((group) =>
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
                  <td class="recipe-cell meta">{recipe.requirements?.trim() ? recipe.requirements : empty}</td>
                )}
                <td class="recipe-cell tags">
                  <div class="recipe-row-tags">
                    {visibleRecipeTags(recipeResultTags(recipe)).map((tag) => (
                      <button key={tag} type="button" class="recipe-search-tag" data-filter-tag={tag}>
                        {tagLabel(tag, labels)}
                      </button>
                    ))}
                  </div>
                </td>
                <td class="recipe-cell meta">{recipe.source?.trim() ? recipe.source : empty}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}
