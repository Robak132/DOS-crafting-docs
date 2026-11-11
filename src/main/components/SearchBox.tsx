import type { ComponentChildren } from "preact"
import { useLayoutEffect, useRef, useState } from "preact/hooks"
import type { SearchSuggestion, SuggestionIndex } from "../domain/searchSuggestions"
import { ItemIcon } from "./ItemIcon"

type Props = {
  query: string
  placeholder: string
  lang: "pl" | "en"
  suggestions?: SuggestionIndex
  onInput: (value: string) => void
  /** Enter without a picked suggestion, or a picked one: the search to run now. */
  onSubmit: (value: string) => void
  /** The scope selector beside the input. */
  children?: ComponentChildren
}

function picked(suggestion: SearchSuggestion, lang: "pl" | "en"): string {
  return suggestion.token ?? ((lang === "pl" && suggestion.pl) || suggestion.en)
}

/** The site's search box: completes item names in both languages and comes to the centre while typing. */
export function SearchBox({ query, placeholder, lang, suggestions, onInput, onSubmit, children }: Readonly<Props>) {
  const form = useRef<HTMLFormElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  // The box leaves the sidebar while centred; its place keeps the height so nothing below moves.
  const [height, setHeight] = useState<number>()
  useLayoutEffect(() => {
    if (!focused && form.current) setHeight(form.current.offsetHeight)
  }, [focused])
  const matches = focused ? (suggestions?.suggest(query) ?? []) : []
  const choose = (suggestion: SearchSuggestion) => {
    const value = picked(suggestion, lang)
    onSubmit(value)
    input.current?.blur()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!matches.length) return
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      // -1 is the typed text itself; the arrows cycle through it and the suggestions.
      setActive((index) => ((index + 1 + step + matches.length + 1) % (matches.length + 1)) - 1)
    } else if (event.key === "Escape") {
      event.preventDefault()
      input.current?.blur()
    } else if (event.key === "Tab" && matches.length && !event.shiftKey) {
      event.preventDefault()
      onInput(picked(matches[Math.max(active, 0)], lang))
      setActive(-1)
    }
  }
  return (
    <div class="catalog-search-slot" style={focused && height ? { height: `${height}px` } : undefined}>
      {/* A press outside the field blurs it on its own; the backdrop only dims the page. */}
      {focused && <div class="search-backdrop" />}
      <form
        ref={form}
        class="catalog-search"
        data-focused={focused}
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          if (active >= 0 && matches[active]) choose(matches[active])
          else {
            onSubmit(query)
            input.current?.blur()
          }
        }}
      >
        <label htmlFor="recipe-search-input">
          Szukaj <kbd class="shortcut">Ctrl+Spacja</kbd>
        </label>
        <div class="search-row">
          <input
            ref={input}
            id="recipe-search-input"
            type="search"
            autocomplete="off"
            aria-controls="search-suggestions"
            aria-activedescendant={active >= 0 ? `search-suggestion-${active}` : undefined}
            title='Ctrl+Spacja: przejdź do wyszukiwarki. Tab: uzupełnij. Grupy: #NazwaGrupy albo #"Nazwa grupy"'
            aria-keyshortcuts="Control+Space"
            value={query}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              setActive(-1)
            }}
            onInput={(event) => {
              setActive(-1)
              onInput(event.currentTarget.value)
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
          />
          {children}
        </div>
        {matches.length > 0 && (
          // Clicks must not take the focus away before the pick lands.
          <ul
            id="search-suggestions"
            class="search-suggestions"
            role="listbox"
            onMouseDown={(event) => event.preventDefault()}
          >
            {matches.map((suggestion, index) => {
              const [main, other] =
                lang === "pl" && suggestion.pl ? [suggestion.pl, suggestion.en] : [suggestion.en, suggestion.pl]
              return (
                <li
                  key={suggestion.key}
                  id={`search-suggestion-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(suggestion)}
                  onKeyDown={(event) => event.key === "Enter" && choose(suggestion)}
                >
                  {suggestion.icon ? (
                    <ItemIcon icon={suggestion.icon} />
                  ) : (
                    <span class="search-suggestion-hash">{suggestion.token ? "#" : ""}</span>
                  )}
                  <span class="search-suggestion-name">{main}</span>
                  {other && other !== main && <span class="search-suggestion-other">{other}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </form>
    </div>
  )
}
