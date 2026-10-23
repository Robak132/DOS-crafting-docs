/** Group and selector names are stored as "#Water-Source"; people read "Water Source". */
export function displayItemName(name: string): string {
  return name.startsWith("#") ? name.slice(1).replaceAll("-", " ") : name
}
