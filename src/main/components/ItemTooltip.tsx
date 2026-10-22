import type { RefObject } from "preact"
import type { RecipeItem, RecipeRow } from "../domain/recipes"
import { formatItemQuantity } from "../domain/recipeQuantity"
import { uniqueItemEffects } from "../domain/recipeView"
import { ItemIcon } from "./ItemIcon"

export type ItemDescription = { en: string; pl?: string }

export function itemDescriptionText(description: ItemDescription | undefined, lang: "pl" | "en"): string {
  return (lang === "pl" && description?.pl?.trim()) || description?.en?.trim() || ""
}

export function tooltipItemName(item: RecipeItem, lang: "pl" | "en"): string {
  const polish = item.namePl?.trim()
  return lang === "pl" && polish && polish.toLocaleLowerCase() !== item.name.trim().toLocaleLowerCase()
    ? `${polish} (${item.name})`
    : item.name
}

function ingredientName(item: RecipeItem, lang: "pl" | "en"): string {
  const quantity = formatItemQuantity(item.quantity)
  return `${quantity ? quantity + " " : ""}${tooltipItemName(item, lang)}`
}

export function ItemTooltip({
  item,
  lang,
  recipes,
  description,
  elementRef,
}: {
  item: RecipeItem
  lang: "pl" | "en"
  recipes: RecipeRow[]
  description?: ItemDescription
  elementRef?: RefObject<HTMLDivElement | null>
}) {
  const effects = uniqueItemEffects(recipes, lang, item)
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
                <span class="preview-recipe-result">→ {ingredientName(recipe.result, lang)}</span>
                {recipe.requirements.trim() && <small>Wymagania: {recipe.requirements}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
