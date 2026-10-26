import { ItemIcon } from "./ItemIcon"
import type { RecipeItem, RecipeUpgrade } from "../domain/recipes"
import { tagLabel, visibleRecipeTags } from "../domain/recipeView"
import { games, type Game } from "../routing"
import { ItemLabel, RecipeItemView } from "./RecipeItem"

type Props = {
  upgrades: RecipeUpgrade[]
  labels: Record<string, string>
  game: Game
  showRequirements?: boolean
}

function Bilingual({ en, pl }: Readonly<{ en: string; pl?: string }>) {
  if (pl && pl !== en)
    return (
      <span class="item-lang">
        <span class="item-lang-en">{en}</span>
        <span class="item-lang-pl">{pl}</span>
      </span>
    )
  return <span class="item-lang">{en}</span>
}

function PlainTarget({ item }: Readonly<{ item: RecipeItem }>) {
  return (
    <span class="recipe-item">
      <ItemIcon icon={item.icon} />
      <ItemLabel item={item} />
    </span>
  )
}

export function UpgradeTable({ upgrades, labels, game, showRequirements = false }: Readonly<Props>) {
  const catalogSlug = games.find((entry) => entry.id === game)!.slug
  if (upgrades.length === 0) return <p class="recipe-empty">Brak ulepszeń pasujących do filtrów.</p>
  return (
    <div class="recipe-table-wrap" role="region" aria-label="Lista ulepszeń przedmiotów" tabIndex={0}>
      <table class="recipe-table upgrade-table">
        <thead>
          <tr>
            <th scope="col">Efekt</th>
            <th scope="col">Na co</th>
            <th scope="col">Składniki</th>
            {showRequirements && <th scope="col">Wymagania</th>}
            <th scope="col">Tagi</th>
            <th scope="col">Źródło</th>
          </tr>
        </thead>
        <tbody class="recipe-table-body">
          {upgrades.map((upgrade, index) => (
            <tr key={`${upgrade.id}#${index}`} class="recipe-group-start recipe-group-end">
              <td class="recipe-cell result">
                <strong>
                  <Bilingual en={upgrade.effect.en} pl={upgrade.effect.pl} />
                </strong>
                {upgrade.notes.trim() && <p class="recipe-remarks">{upgrade.notes}</p>}
              </td>
              <td class="recipe-cell ingredients">
                {upgrade.targets?.length ? (
                  <ul class="recipe-ingredients">
                    {upgrade.targets.map((target, position) => (
                      <li key={position}>
                        <RecipeItemView item={target} catalogSlug={catalogSlug} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <PlainTarget item={upgrade.target} />
                )}
              </td>
              <td class="recipe-cell ingredients">
                <ul class="recipe-ingredients">
                  {upgrade.ingredients.map((item, position) => (
                    <li key={position}>
                      <RecipeItemView item={item} catalogSlug={catalogSlug} ingredient />
                    </li>
                  ))}
                </ul>
                {upgrade.remarks.trim() && <p class="recipe-remarks">{upgrade.remarks}</p>}
              </td>
              {showRequirements && (
                <td class="recipe-cell meta">{upgrade.requirements.trim() || <span class="recipe-empty">—</span>}</td>
              )}
              <td class="recipe-cell tags">
                <div class="recipe-row-tags">
                  {visibleRecipeTags(upgrade.tags).map((tag) => (
                    <button key={tag} type="button" class="recipe-search-tag" data-filter-tag={tag}>
                      {tagLabel(tag, labels)}
                    </button>
                  ))}
                </div>
              </td>
              <td class="recipe-cell meta">{upgrade.source.trim() || <span class="recipe-empty">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
