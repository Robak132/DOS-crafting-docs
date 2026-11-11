import type { ComponentChild } from "preact"
import { ItemIcon } from "./ItemIcon"
import { CraftRoles, type ItemCraftRole } from "../domain/craftRoles"
import { GroupQuery } from "../domain/groupSearch"
import { Item } from "../domain/item"
import { gameForSlug, itemHref, pageHref } from "../routing"

/** English name with the Polish one below; group names ("#Water-Source") read as plain words. */
export function ItemLabel({ item }: Readonly<{ item: Item }>) {
  const name = Item.displayName(item.name)
  const namePl = item.namePl ? Item.displayName(item.namePl) : undefined
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
  item: Item
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
  const withQuantity = (node: ComponentChild, item: Item) => {
    const qty = item.quantityLabel
    if (!qty) return <>{node}</>
    return (
      <span class="recipe-item-wrap">
        {node}
        <span class="recipe-item-qty"> {qty}</span>
      </span>
    )
  }
  const title = item.polishTitle
  const searchText = item.name.replace(/^#/, "")
  // Unique items are framed in their rarity colour, as in the game's inventory.
  const craftClass = [CraftRoles.cssClass(item.slug ? itemRoles[item.slug] : undefined), item.unique && "rarity-unique"]
    .filter(Boolean)
    .join(" ")
  if (item.groupId) {
    return withQuantity(
      <a
        class="internal recipe-item recipe-item-group"
        data-no-popover="true"
        href={`${pageHref(catalogSlug)}?view=items&q=${encodeURIComponent(GroupQuery.token(item))}&as=result`}
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
        data-tooltip-key={item.tooltipKey}
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
        data-tooltip-key={item.tooltipKey}
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
      data-tooltip-key={item.tooltipKey}
    >
      <ItemIcon icon={item.icon} />
      <ItemLabel item={item} />
    </span>,
    item,
  )
}
