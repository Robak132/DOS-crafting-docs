/** A recipe's skill requirements as written in the data: "Crafting 3; Blacksmithing 4", or empty. */
export class Requirements {
  constructor(private readonly text: string) {}

  /** Each requirement on its own ("Crafting 3"); none → ["-"]. */
  tokens(): string[] {
    const tokens = this.text
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean)
    return tokens.length > 0 ? tokens : ["-"]
  }

  /** Highest skill level asked for ("Crafting 3; Blacksmithing 4" → 4); none → 0. */
  level(): number {
    return Math.max(0, ...this.tokens().map(trailingNumber))
  }

  /**
   * Whether a crafter with Crafting ≤ maxLevel can make it: no requirement, or Crafting 1..maxLevel.
   * A higher Crafting level, or Blacksmithing or Tenebrium alone, is not enough.
   */
  allowCraftingLevel(maxLevel: number): boolean {
    if (!Number.isFinite(maxLevel) || maxLevel < 1) return true
    return this.tokens().some((token) => {
      if (token === "-") return true
      const match = /^Crafting\s+(\d+)$/i.exec(token)
      return Boolean(match && Number(match[1]) <= maxLevel)
    })
  }
}

/** The number a text ends with ("Crafting 3" → 3); none → 0. */
function trailingNumber(text: string): number {
  let start = text.length
  while (start > 0 && text[start - 1] >= "0" && text[start - 1] <= "9") start--
  return start < text.length ? Number(text.slice(start)) : 0
}

export const CRAFTING_MAX_LEVELS = [1, 2, 3, 4, 5] as const
