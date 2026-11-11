import type { RefObject } from "preact"
import { Item, type Lang } from "../domain/item"
import { effectBullets, ItemRecipes } from "../domain/itemList"
import type { Recipe } from "../domain/recipe"
import { ItemIcon } from "./ItemIcon"

export type ItemDescription = { en: string; pl?: string }

export function itemDescriptionText(description: ItemDescription | undefined, lang: Lang): string {
  return (lang === "pl" && description?.pl?.trim()) || description?.en?.trim() || ""
}

export function tooltipItemName(item: Item, lang: Lang): string {
  const name = Item.displayName(item.name.trim())
  const polish = item.namePl ? Item.displayName(item.namePl.trim()) : undefined
  return lang === "pl" && polish && polish.toLocaleLowerCase() !== name.toLocaleLowerCase()
    ? `${polish} (${name})`
    : name
}

/** One item of a recipe as its icon and quantity; the name is on hover. An item without an icon shows its name. */
function PreviewItem({ item, lang }: Readonly<{ item: Item; lang: Lang }>) {
  const quantity = item.quantityLabel
  const name = tooltipItemName(item, lang)
  return (
    <span class="preview-item" title={name} aria-label={quantity ? `${quantity} ${name}` : name}>
      {item.icon ? <ItemIcon icon={item.icon} /> : <span class="preview-item-name">{item.shownName(lang)}</span>}
      {quantity && <span class="preview-item-qty">{quantity}</span>}
    </span>
  )
}

function PreviewItems({ items, lang }: Readonly<{ items: Item[]; lang: Lang }>) {
  return (
    <>
      {Item.keyed(items).flatMap(([key, item], index) => [
        index > 0 && (
          <span key={`plus${key}`} class="preview-plus">
            +
          </span>
        ),
        <PreviewItem key={key} item={item} lang={lang} />,
      ])}
    </>
  )
}

export function ItemTooltip({
  item,
  lang,
  recipes,
  description,
  elementRef,
}: Readonly<{
  item: Item
  lang: Lang
  recipes: Recipe[]
  description?: ItemDescription
  elementRef?: RefObject<HTMLDivElement | null>
}>) {
  const effects = effectBullets(new ItemRecipes(recipes, item).effects(lang))
  const descriptionText = itemDescriptionText(description, lang)
  return (
    <div ref={elementRef} class="item-preview" role="tooltip">
      <strong class="preview-title">
        <ItemIcon icon={item.icon} />
        {tooltipItemName(item, lang)}
      </strong>
      {descriptionText && (
        <section>
          <h3>Opis</h3>
          <p>{descriptionText}</p>
        </section>
      )}
      {effects.length > 0 && (
        <section>
          <h3>Efekt</h3>
          <ul class="preview-effects">
            {effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
        </section>
      )}
      {recipes.length > 0 && (
        <section>
          <h3>Wytwarzanie</h3>
          <ul class="preview-recipes">
            {recipes.map((recipe, index) => (
              <li key={`${recipe.id}#${index}`}>
                <span class="preview-recipe-items">
                  <PreviewItems items={recipe.ingredients} lang={lang} />
                </span>
                <span class="preview-recipe-items preview-recipe-result">
                  <span class="preview-arrow">→</span>
                  <PreviewItems items={recipe.results()} lang={lang} />
                </span>
                {recipe.requirements.trim() && <small>Wymagania: {recipe.requirements}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
