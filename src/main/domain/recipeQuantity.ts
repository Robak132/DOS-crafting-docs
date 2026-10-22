/** (x2) / (2x) / (x2 or x3) / (2x or 3x) */
const QUANTITY_OR_RE = /\s*\(\s*((?:X\d+|\d+X))\s+OR\s+((?:X\d+|\d+X))\s*\)\s*$/i
const QUANTITY_SINGLE_RE = /\s*\(\s*((?:X\d+|\d+X))\s*\)\s*$/i
/** „Arrowhead x3” / „Arrowhead ×4” (bez nawiasów) */
const QUANTITY_TRAILING_RE = /\s+[x×](\d+)\s*$/i
/** „Arrowhead and Arrowhead” → ta sama nazwa dwukrotnie = x2 */
const QUANTITY_AND_SAME_RE = /^(.+?)\s+and\s+(.+)$/i

function normalizeQtyToken(raw: string): string {
  const match = raw.trim().match(/^x?(\d+)x?$/i)
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
  const orMatch = leaf.match(QUANTITY_OR_RE)
  if (orMatch) {
    return {
      base: `${prefix}${leaf.replace(QUANTITY_OR_RE, "").trim()}`,
      quantities: [normalizeQtyToken(orMatch[1]), normalizeQtyToken(orMatch[2])],
    }
  }
  const single = leaf.match(QUANTITY_SINGLE_RE)
  if (single) {
    return {
      base: `${prefix}${leaf.replace(QUANTITY_SINGLE_RE, "").trim()}`,
      quantities: [normalizeQtyToken(single[1])],
    }
  }
  const trailing = leaf.match(QUANTITY_TRAILING_RE)
  if (trailing) {
    return {
      base: `${prefix}${leaf.replace(QUANTITY_TRAILING_RE, "").trim()}`,
      quantities: [normalizeQtyToken(`x${trailing[1]}`)],
    }
  }
  const andSame = leaf.match(QUANTITY_AND_SAME_RE)
  if (andSame && normalizeNameKey(andSame[1]) === normalizeNameKey(andSame[2])) {
    return {
      base: `${prefix}${andSame[1].trim()}`,
      quantities: ["x2"],
    }
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
  const random = quantity.trim().match(RANDOM_QUANTITY_RE)
  if (random) return random[1] ? `×(${random[1]}–${random[2]})` : "×(?)"
  const normalized = normalizeQtyToken(quantity)
  const digits = normalized.replace(/^x/i, "")
  return digits ? `×${digits}` : ""
}
