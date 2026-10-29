function normalizeQtyToken(raw: string): string {
  const match = /^x?(\d+)x?$/i.exec(raw.trim())
  return match ? `x${match[1]}` : raw.trim().toLowerCase()
}

/** Losowa ilość: "x(1-3)" lub nieznany zakres "x(?)". */
const RANDOM_QUANTITY_RE = /^x\((?:(\d+)-(\d+)|\?)\)$/i

export function formatItemQuantity(quantity: string | undefined): string {
  if (!quantity) return ""
  const random = RANDOM_QUANTITY_RE.exec(quantity.trim())
  if (random) return random[1] ? `×(${random[1]}–${random[2]})` : "×(?)"
  const normalized = normalizeQtyToken(quantity)
  const digits = normalized.replace(/^x/i, "")
  return digits ? `×${digits}` : ""
}
