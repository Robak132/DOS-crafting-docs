import { ItemIcon } from "./ItemIcon"
import type { RecipeItem, RecipeUpgrade } from "../domain/recipes"
import { formatItemQuantity } from "../domain/recipeQuantity"
import { tagLabel, visibleRecipeTags } from "../domain/recipeView"
import { tooltipItemKey } from "../domain/tooltipIdentity"
import { games, itemHref, pageHref, type Game } from "../routing"

type Props = {
  upgrades: RecipeUpgrade[]
  labels: Record<string, string>
  game: Game
  showRequirements?: boolean
}

function Bilingual({ en, pl }: { en: string; pl?: string }) {
  if (pl && pl !== en)
    return (
      <span class="item-lang">
        <span class="item-lang-en">{en}</span>
        <span class="item-lang-pl">{pl}</span>
      </span>
    )
  return <span class="item-lang">{en}</span>
}

function Item({ item, game }: { item: RecipeItem; game: Game }) {
  const name = item.selectorTag ? item.name.replace(/^#/, "").replaceAll("-", " ") : item.name
  const label = (
    <>
      <ItemIcon icon={item.icon} />
      <Bilingual en={name} pl={item.namePl?.replace(/^#/, "")} />
    </>
  )
  const quantity = formatItemQuantity(item.quantity)
  if (item.groupId) {
    const slug = games.find((entry) => entry.id === game)!.slug
    return (
      <a
        class="internal recipe-item recipe-item-group"
        data-no-popover="true"
        href={`${pageHref(slug)}?view=items&group=${encodeURIComponent(item.groupId)}`}
      >
        {label}
        <span class="group-count">{item.groupSize}</span>
      </a>
    )
  }
  return (
    <>
      {item.slug && !item.selectorTag ? (
        <a
          class="internal recipe-item"
          data-slug={item.slug}
          data-tooltip-key={tooltipItemKey(item)}
          href={itemHref(game, item.slug)}
        >
          {label}
        </a>
      ) : (
        <span class="recipe-item">{label}</span>
      )}
      {quantity && <span class="recipe-item-qty"> {quantity}</span>}
    </>
  )
}

export function UpgradeTable({ upgrades, labels, game, showRequirements = false }: Props) {
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
              <td class="recipe-cell">
                <Item item={upgrade.target} game={game} />
              </td>
              <td class="recipe-cell ingredients">
                <ul class="recipe-ingredients">
                  {upgrade.ingredients.map((item, position) => (
                    <li key={position}>
                      <Item item={item} game={game} />
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
