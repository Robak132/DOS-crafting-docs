/** The forms of a text that lookups and searches compare, so "Łuk", "luk" and "#Luk" can meet. */
export class TextKey {
  /** An item name as a data key: lowercase letters and digits only ("Sharp Piece Of Metal" → "sharppieceofmetal"). */
  static item(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFKD")
      .replaceAll("ł", "l")
      .replace(/[^a-z0-9]/g, "")
  }

  /** The keys several names of one item answer to, without diacritics or a group's leading "#". */
  static names(...names: Array<string | undefined>): Set<string> {
    return new Set(
      names
        .filter((value): value is string => Boolean(value))
        .map((value) =>
          TextKey.withoutDiacritics(value)
            .replace(/^#/, "")
            .replace(/[^a-z0-9]+/g, ""),
        )
        .filter(Boolean),
    )
  }

  /** Text as a search compares it: lowercase, without diacritics, dashes read as spaces. */
  static search(value: string): string {
    return TextKey.withoutDiacritics(value).replaceAll("-", " ")
  }

  private static withoutDiacritics(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("ł", "l")
      .replaceAll("Ł", "l")
      .toLowerCase()
  }
}
