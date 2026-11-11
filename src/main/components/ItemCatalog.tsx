import type { ItemCraftRole } from "../domain/craftRoles"
import { Item, type Lang } from "../domain/item"
import { effectBullets, type ItemRow } from "../domain/itemList"
import type { Recipe } from "../domain/recipe"
import type { TagLabels } from "../domain/tagLabels"
import { gameForSlug, itemHref } from "../routing"
import { ItemIcon } from "./ItemIcon"
import { itemDescriptionText, type ItemDescription } from "./ItemTooltip"
import { RecipeItemView } from "./RecipeItem"
import { useIncremental } from "./useIncremental"

type Props = {
  rows: ItemRow[]
  labels: TagLabels
  catalogSlug: string
  lang: Lang
  /** DOS1 recipes need crafting levels; DOS2 ones have none. */
  showRequirements?: boolean
  itemRoles?: Record<string, ItemCraftRole>
  descriptions?: Record<string, ItemDescription>
  /** Render this many items first and add more on scroll. */
  pageSize?: number
}

/** Search results: one card per item with everything known about it, its recipes included. */
export function ItemCatalog({
  rows,
  labels,
  catalogSlug,
  lang,
  showRequirements = false,
  itemRoles = {},
  descriptions = {},
  pageSize,
}: Readonly<Props>) {
  const shown = useIncremental(rows, pageSize)
  if (rows.length === 0) return <p class="recipe-empty">Brak przedmiotów pasujących do filtrów.</p>
  const chip = (item: Item, ingredient = false) => (
    <RecipeItemView item={item} catalogSlug={catalogSlug} ingredient={ingredient} searchable itemRoles={itemRoles} />
  )
  return (
    <section class="item-catalog" aria-label="Przedmioty i receptury">
      {shown.visible.map((row) => (
        <ItemCard
          key={row.item.slug ?? row.item.name}
          row={row}
          labels={labels}
          catalogSlug={catalogSlug}
          lang={lang}
          showRequirements={showRequirements}
          description={itemDescriptionText(descriptions[row.item.resourceKey], lang)}
          chip={chip}
        />
      ))}
      {shown.hidden > 0 && (
        <div ref={shown.sentinel} class="load-more">
          <button type="button" onClick={shown.showAll}>
            Pokaż wszystkie (jeszcze {shown.hidden})
          </button>
        </div>
      )}
    </section>
  )
}

type CardProps = {
  row: ItemRow
  labels: TagLabels
  catalogSlug: string
  lang: Lang
  showRequirements: boolean
  description: string
  chip: (item: Item, ingredient?: boolean) => preact.JSX.Element
}

function ItemCard({ row, labels, catalogSlug, lang, showRequirements, description, chip }: Readonly<CardProps>) {
  const { item, effects, tags, crafts, rolls } = row
  const game = gameForSlug(catalogSlug) ?? "dos1"
  const name = item.shownName(lang)
  const other = lang === "pl" ? item.name : item.polishTitle
  const href = item.slug ? itemHref(game, item.slug) : undefined
  const title = (
    <>
      <ItemIcon icon={item.icon} />
      <span class="item-card-names">
        <strong>{name}</strong>
        {other && other !== name && <span class="item-card-alt">{other}</span>}
      </span>
    </>
  )
  const bullets = effectBullets(effects)
  return (
    <article class={item.unique ? "item-card rarity-unique" : "item-card"}>
      <header class="item-card-head">
        {href ? (
          <a class="internal item-card-title" href={href} data-no-popover="true">
            {title}
          </a>
        ) : (
          <span class="item-card-title">{title}</span>
        )}
        {tags.length > 0 && (
          <div class="recipe-row-tags">
            {tags.map((tag) => (
              <button key={tag} type="button" class="recipe-search-tag" data-filter-tag={tag}>
                {labels.label(tag)}
              </button>
            ))}
          </div>
        )}
      </header>
      {description && <p class="item-card-description">{description}</p>}
      {bullets.length > 0 && (
        <section class="item-card-section">
          <h3>Efekt</h3>
          <ul class="item-card-effects">
            {bullets.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </section>
      )}
      {crafts.length > 0 && (
        <section class="item-card-section">
          <h3>Wytwarzanie</h3>
          <ul class="item-card-recipes">
            {crafts.map((recipe, index) => (
              <RecipeLine
                key={`${recipe.id}#${index}`}
                recipe={recipe}
                item={item}
                showRequirements={showRequirements}
                lang={lang}
                chip={chip}
              />
            ))}
          </ul>
        </section>
      )}
      {rolls.length > 0 && (
        <section class="item-card-section">
          <h3>Można wylosować z</h3>
          <ul class="item-card-recipes">
            {rolls.map((recipe, index) => (
              <RecipeLine
                key={`${recipe.id}#${index}`}
                recipe={recipe}
                item={item}
                showRequirements={showRequirements}
                lang={lang}
                chip={chip}
              />
            ))}
          </ul>
        </section>
      )}
      {crafts.length === 0 && rolls.length === 0 && <p class="item-card-note">Nie da się go wytworzyć.</p>}
    </article>
  )
}

/** One recipe in a card: ingredients → what it gives, with its level, source and remarks. */
function RecipeLine({
  recipe,
  item,
  showRequirements,
  lang,
  chip,
}: Readonly<{
  recipe: Recipe
  item: Item
  showRequirements: boolean
  lang: Lang
  chip: (item: Item, ingredient?: boolean) => preact.JSX.Element
}>) {
  const key = item.slug ?? item.name
  const rolled = recipe.result.pool?.find((entry) => (entry.slug ?? entry.name) === key)
  const product = rolled ? recipe.result : recipe.productFor(item)
  const others = rolled ? [] : recipe.results().filter((entry) => entry !== product)
  const requirements = [...new Set([recipe.requirements.trim(), rolled?.requirements?.trim()].filter(Boolean))].join(
    ", ",
  )
  const remarks = recipe.remarks.trim() === "-" ? "" : recipe.remarks.trim()
  return (
    <li class="item-card-recipe">
      <div class="item-card-recipe-line">
        {Item.keyed(recipe.ingredients).flatMap(([key, ingredient], index) => [
          index > 0 && (
            <span key={`plus${key}`} class="recipe-plus">
              +
            </span>
          ),
          <span key={key}>{chip(ingredient, true)}</span>,
        ])}
        <span class="recipe-arrow">→</span>
        {rolled ? chip(recipe.result) : <span class="item-card-yield">{product.quantityLabel || "×1"}</span>}
        {Item.keyed(others).flatMap(([key, entry]) => [
          <span key={`plus${key}`} class="recipe-plus">
            +
          </span>,
          <span key={key}>{chip(entry)}</span>,
        ])}
      </div>
      {(showRequirements && requirements) || recipe.source.trim() ? (
        <p class="item-card-meta">
          {showRequirements && requirements && <span>Wymagania: {requirements}</span>}
          {recipe.source.trim() && <span>Źródło: {recipe.sourceText(lang)}</span>}
        </p>
      ) : null}
      {recipe.transformsIngredient !== undefined && recipe.notes.trim() && <p class="recipe-remarks">{recipe.notes}</p>}
      {remarks && <p class="recipe-remarks">{remarks}</p>}
    </li>
  )
}
