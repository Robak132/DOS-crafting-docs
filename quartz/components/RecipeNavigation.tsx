import { FullSlug, resolveRelative } from "../util/path"
import { OVERHAUL_SLUG } from "./recipeCatalog"

export function RecipeNavigation({ slug }: { slug: FullSlug }) {
  return (
    <nav class="recipe-tabs" aria-label="Katalog przepisów">
      {[
        { slug: "receptury", label: "DOS1 – Receptury" },
        { slug: OVERHAUL_SLUG, label: "DOS2 – Crafting Overhaul" },
      ].map((tab) => (
        <a
          class="internal recipe-nav-link"
          href={resolveRelative(slug, tab.slug as FullSlug)}
          aria-current={slug === tab.slug ? "page" : undefined}
          data-no-popover="true"
        >
          {tab.label}
        </a>
      ))}
    </nav>
  )
}
