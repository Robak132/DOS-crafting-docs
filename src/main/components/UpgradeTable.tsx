import { ItemIcon } from "./ItemIcon"
import { Item } from "../domain/item"
import type { TagLabels } from "../domain/tagLabels"
import { TagSidebar } from "../domain/tagSidebar"
import type { Upgrade } from "../domain/upgrade"
import { games, type Game } from "../routing"
import { ItemLabel, RecipeItemView } from "./RecipeItem"

type Props = {
  upgrades: Upgrade[]
  labels: TagLabels
  game: Game
  showRequirements?: boolean
  /** The "Na co" column; an item page lists only upgrades of that item, so it hides it. */
  showTargets?: boolean
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

function PlainTarget({ item }: Readonly<{ item: Item }>) {
  return (
    <span class="recipe-item">
      <ItemIcon icon={item.icon} />
      <ItemLabel item={item} />
    </span>
  )
}

export function UpgradeTable({
  upgrades,
  labels,
  game,
  showRequirements = false,
  showTargets = true,
}: Readonly<Props>) {
  const catalogSlug = games.find((entry) => entry.id === game)!.slug
  if (upgrades.length === 0) return <p class="recipe-empty">Brak ulepszeń pasujących do filtrów.</p>
  return (
    <section class="recipe-table-wrap" aria-label="Lista ulepszeń przedmiotów">
      <table class="recipe-table upgrade-table">
        <thead>
          <tr>
            <th scope="col">Efekt</th>
            {showTargets && <th scope="col">Na co</th>}
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
                  <Bilingual en={upgrade.title("en")} pl={upgrade.title("pl")} />
                </strong>
                {upgrade.notes.trim() && <p class="recipe-remarks">{upgrade.notes}</p>}
              </td>
              {showTargets && (
                <td class="recipe-cell ingredients targets">
                  {upgrade.targets?.length ? (
                    <ul class="recipe-ingredients">
                      {Item.keyed(upgrade.targets).map(([key, target]) => (
                        <li key={key}>
                          <RecipeItemView item={target} catalogSlug={catalogSlug} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <PlainTarget item={upgrade.target} />
                  )}
                </td>
              )}
              <td class="recipe-cell ingredients">
                <ul class="recipe-ingredients">
                  {Item.keyed(upgrade.ingredients).map(([key, item]) => (
                    <li key={key}>
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
                  {TagSidebar.visibleTags(upgrade.tags).map((tag) => (
                    <button key={tag} type="button" class="recipe-search-tag" data-filter-tag={tag}>
                      {labels.label(tag)}
                    </button>
                  ))}
                </div>
              </td>
              <td class="recipe-cell meta">{upgrade.source.trim() || <span class="recipe-empty">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
