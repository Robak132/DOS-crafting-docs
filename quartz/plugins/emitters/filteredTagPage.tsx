import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { FullPageLayout } from "../../cfg"
import { pathToRoot, FullSlug } from "../../util/path"
import { sharedPageComponents, defaultListPageLayout } from "../../../quartz.layout"
import RecipeTablePage from "../../components/pages/RecipeTablePage"
import { write } from "./helpers"
import { QuartzPluginData } from "../vfile"
import { Root } from "hast"

export const FilteredTagPage: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: RecipeTablePage(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "FilteredTagPage",
    getQuartzComponents() {
      return [Head, Header, Body, ...header, ...beforeBody, pageBody, ...afterBody, ...left, ...right, Footer]
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data)
      for (const page of [{ slug: "receptury", title: "Receptury" }]) {
        const slug = page.slug as FullSlug
        const cfg = ctx.cfg.configuration

        // Create a fake file data for the filter page
        const fileData: QuartzPluginData = {
          slug,
          frontmatter: {
            title: page.title,
            tags: [],
          },
        } as QuartzPluginData

        const externalResources = pageResources(pathToRoot(slug), resources)
        const componentData: QuartzComponentProps = {
          ctx,
          fileData,
          externalResources,
          cfg,
          children: [],
          tree: { type: "root", children: [] } as Root,
          allFiles,
        }

        const contentHtml = renderPage(cfg, slug, componentData, opts, externalResources)
        yield write({
          ctx,
          content: contentHtml,
          slug,
          ext: ".html",
        })
      }
    },
  }
}
