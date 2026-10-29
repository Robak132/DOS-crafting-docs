import type { RefObject } from "preact"
import { Item, type Lang } from "../domain/item"
import { ItemRecipes } from "../domain/itemList"
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

function ingredientName(item: Item, lang: Lang): string {
  const quantity = item.quantityLabel
  return `${quantity ? quantity + " " : ""}${tooltipItemName(item, lang)}`
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
  const effects = new ItemRecipes(recipes, item).effects(lang)
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
          <p>{effects.join(" · ")}</p>
        </section>
      )}
      {recipes.length > 0 && (
        <section>
          <h3>Wytwarzanie</h3>
          <ul class="preview-recipes">
            {recipes.map((recipe, index) => (
              <li key={`${recipe.id}#${index}`}>
                <span>{recipe.ingredients.map((ingredient) => ingredientName(ingredient, lang)).join(" + ")}</span>
                <span class="preview-recipe-result">
                  →{" "}
                  {recipe
                    .results()
                    .map((product) => ingredientName(product, lang))
                    .join(" + ")}
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
