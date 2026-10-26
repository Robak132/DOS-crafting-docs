/** (x2) / (2x) / (x2 or x3) / (2x or 3x), at the end of a trimmed name */
const QUANTITY_OR_RE = /\(\s*(x\d+|\d+x)\s+or\s+(x\d+|\d+x)\s*\)$/i
const QUANTITY_SINGLE_RE = /\(\s*(x\d+|\d+x)\s*\)$/i
/** „Arrowhead x3” / „Arrowhead ×4” (bez nawiasów) */
const QUANTITY_TRAILING_RE = /\s[x×](\d+)$/i
/** „Arrowhead and Arrowhead” → ta sama nazwa dwukrotnie = x2 */
const AND_RE = /\sand\s/i

function normalizeQtyToken(raw: string): string {
  const match = /^x?(\d+)x?$/i.exec(raw.trim())
  return match ? `x${match[1]}` : raw.trim().toLowerCase()
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

/** „Name (x2 or x3)” / „Name (2X)” / „Name x3” / „Name and Name” → bazowa nazwa + ilości. */
export function parseItemQuantity(raw: string): { base: string; quantities: string[] } {
  const slash = raw.lastIndexOf("/")
  const prefix = slash >= 0 ? raw.slice(0, slash + 1) : ""
  const leaf = slash >= 0 ? raw.slice(slash + 1) : raw
  // The patterns anchor at the end of the trimmed name, so they never backtrack over its spaces.
  const text = leaf.trimEnd()
  const before = (match: RegExpExecArray) => `${prefix}${text.slice(0, match.index).trim()}`
  const orMatch = QUANTITY_OR_RE.exec(text)
  if (orMatch)
    return { base: before(orMatch), quantities: [normalizeQtyToken(orMatch[1]), normalizeQtyToken(orMatch[2])] }
  const single = QUANTITY_SINGLE_RE.exec(text)
  if (single) return { base: before(single), quantities: [normalizeQtyToken(single[1])] }
  const trailing = QUANTITY_TRAILING_RE.exec(text)
  if (trailing) return { base: before(trailing), quantities: [normalizeQtyToken(`x${trailing[1]}`)] }
  const and = AND_RE.exec(leaf)
  if (and && and.index > 0) {
    const first = leaf.slice(0, and.index)
    const second = leaf.slice(and.index + and[0].length)
    if (second && normalizeNameKey(first) === normalizeNameKey(second))
      return { base: `${prefix}${first.trim()}`, quantities: ["x2"] }
  }
  return { base: raw, quantities: [] }
}

/** Losowa ilość: "x(1-3)" lub nieznany zakres "x(?)". */
const RANDOM_QUANTITY_RE = /^x\((?:(\d+)-(\d+)|\?)\)$/i

export function isRandomQuantity(quantity: string | undefined): boolean {
  return Boolean(quantity && RANDOM_QUANTITY_RE.test(quantity.trim()))
}

export function formatItemQuantity(quantity: string | undefined): string {
  if (!quantity) return ""
  const random = RANDOM_QUANTITY_RE.exec(quantity.trim())
  if (random) return random[1] ? `×(${random[1]}–${random[2]})` : "×(?)"
  const normalized = normalizeQtyToken(quantity)
  const digits = normalized.replace(/^x/i, "")
  return digits ? `×${digits}` : ""
}
