import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { isRecipePage } from "./quartz/components/recipeCatalog"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [Component.Backlinks()],
  footer: Component.Footer(),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle(), Component.TagList()],
  left: [
    Component.PageTitle(),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    Component.ConditionalRender({
      component: Component.RecipeTagSidebar(),
      condition: (props) => isRecipePage(props.fileData.slug),
    }),
    Component.ConditionalRender({
      component: Component.TagExplorer(),
      condition: (props) => !isRecipePage(props.fileData.slug),
    }),
  ],
  right: [],
}

// components for pages that display lists of pages (e.g., tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.ArticleTitle()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
      ],
    }),
    Component.ConditionalRender({
      component: Component.RecipeTagSidebar(),
      condition: (props) => isRecipePage(props.fileData.slug),
    }),
    Component.ConditionalRender({
      component: Component.TagExplorer(),
      condition: (props) => !isRecipePage(props.fileData.slug),
    }),
  ],
  right: [],
}
