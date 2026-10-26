import type { ComponentChild } from "preact"
import { ItemIcon } from "./ItemIcon"
import { tooltipItemKey } from "../domain/tooltipIdentity"
import type { RecipeItem } from "../domain/recipes"
import { formatItemQuantity } from "../domain/recipeQuantity"
import { displayItemName } from "../domain/itemName"
import { groupSearchToken } from "../domain/groupSearch"
import { gameForSlug, itemHref, pageHref } from "../routing"
import { itemCraftRoleClass, type ItemCraftRole } from "../domain/recipeView"

function itemAltTitle(item: RecipeItem): string | undefined {
  if (item.namePl && item.namePl !== item.name) return displayItemName(item.namePl)
  return undefined
}

/** English name with the Polish one below; group names ("#Water-Source") read as plain words. */
export function ItemLabel({ item }: Readonly<{ item: RecipeItem }>) {
  const name = displayItemName(item.name)
  const namePl = item.namePl ? displayItemName(item.namePl) : undefined
  if (namePl && namePl !== name) {
    return (
      <span class="item-lang">
        <span class="item-lang-en">{name}</span>
        <span class="item-lang-pl">{namePl}</span>
      </span>
    )
  }
  return <span class="item-lang">{name}</span>
}

type Props = {
  item: RecipeItem
  catalogSlug: string
  ingredient?: boolean
  searchable?: boolean
  itemRoles?: Record<string, ItemCraftRole>
}

/** One item of a recipe or upgrade: a group link, an item page link, or a search for a selector. */
export function RecipeItemView({
  item,
  catalogSlug,
  ingredient = false,
  searchable = false,
  itemRoles = {},
}: Readonly<Props>) {
  const withQuantity = (node: ComponentChild, item: RecipeItem) => {
    const qty = formatItemQuantity(item.quantity)
    if (!qty) return <>{node}</>
    return (
      <span class="recipe-item-wrap">
        {node}
        <span class="recipe-item-qty"> {qty}</span>
      </span>
    )
  }
  const roleClass = (item: RecipeItem) => itemCraftRoleClass(item.slug ? itemRoles[item.slug] : undefined)
  const title = itemAltTitle(item)
  const searchText = item.name.replace(/^#/, "").replaceAll(/^<|>$/g, "")
  const craftClass = roleClass(item)
  if (item.groupId) {
    return withQuantity(
      <a
        class="internal recipe-item recipe-item-group"
        data-no-popover="true"
        href={`${pageHref(catalogSlug)}?view=items&q=${encodeURIComponent(groupSearchToken(item))}&as=result`}
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
        href={itemHref(gameForSlug(catalogSlug) ?? "dos1", item.slug)}
        title={title}
      >
        <ItemIcon icon={item.icon} />
        <ItemLabel item={item} />
      </a>,
      item,
    )
  }
  if (ingredient && searchable) {
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
  if (ingredient) {
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
