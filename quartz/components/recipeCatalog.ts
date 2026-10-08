import { QuartzPluginData } from "../plugins/vfile"
import { buildRecipeData, RecipeData } from "./recipes"

export const OVERHAUL_SLUG = "dos2-crafting-overhaul"

export function isRecipePage(slug: string | undefined): boolean {
  return slug === "receptury" || slug === OVERHAUL_SLUG
}

export function getRecipeCatalog(allFiles: QuartzPluginData[], slug?: string): RecipeData {
  return buildRecipeData(allFiles, slug === OVERHAUL_SLUG ? "dos2-overhaul" : "dos1")
}
