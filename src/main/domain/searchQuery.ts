import { TextKey } from "./textKey"

/** A search typed by a reader: every word must appear, ignoring case, diacritics and dashes. */
export class SearchQuery {
  readonly terms: string[]

  constructor(readonly text: string) {
    this.terms = text.trim().split(/\s+/).filter(Boolean).map(TextKey.search)
  }

  get isEmpty(): boolean {
    return this.terms.length === 0
  }

  /** Whether every word of the query appears somewhere in these texts. */
  matches(texts: Array<string | undefined>): boolean {
    if (this.isEmpty) return true
    const text = TextKey.search(texts.filter(Boolean).join(" "))
    return this.terms.every((term) => text.includes(term))
  }
}
