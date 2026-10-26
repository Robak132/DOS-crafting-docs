import { isTagWithin } from "../domain/tagTree"
import { useState } from "preact/hooks"
import type { TagFilterNode } from "../domain/recipeView"
import { tagLabel } from "../domain/recipeView"

type Props = {
  entries: TagFilterNode[]
  include: string[]
  exclude: string[]
  labels: Record<string, string>
  onCycle: (tag: string) => void
}

function filterState(tag: string, include: string[], exclude: string[]) {
  if (include.includes(tag)) return "include"
  return exclude.includes(tag) ? "exclude" : "neutral"
}

/** Selecting a parent filters all its descendants; expanding never changes filters. */
export function TagFilterTree({ entries, include, exclude, labels, onCycle }: Readonly<Props>) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return (
    <div class="recipe-tag-list">
      {entries.map((entry) => {
        const label = entry.label?.replaceAll("-", " ") ?? tagLabel(entry.tag, labels)
        const children = entry.children ?? []
        const open =
          expanded[entry.tag] ??
          [...include, ...exclude].some((tag) => tag !== entry.tag && isTagWithin(tag, entry.tag))
        return (
          <div key={entry.tag} class="tag-filter-node">
            <div class="tag-filter-row">
              <button
                type="button"
                class="recipe-tag-button"
                data-state={filterState(entry.tag, include, exclude)}
                onClick={() => onCycle(entry.tag)}
                aria-pressed={include.includes(entry.tag)}
              >
                <span>{label}</span>
                {exclude.includes(entry.tag) && <span class="sr-only"> (wykluczone)</span>}
                <span class="recipe-tag-count">({entry.count})</span>
              </button>
              {children.length > 0 && (
                <button
                  type="button"
                  class="tag-filter-toggle"
                  aria-label={`${open ? "Zwiń" : "Rozwiń"} ${label}`}
                  aria-expanded={open}
                  onClick={() => setExpanded((value) => ({ ...value, [entry.tag]: !open }))}
                >
                  {open ? "▾" : "▸"}
                </button>
              )}
            </div>
            {open && children.length > 0 && (
              <div class="tag-filter-children">
                <TagFilterTree
                  entries={children}
                  include={include}
                  exclude={exclude}
                  labels={labels}
                  onCycle={onCycle}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
