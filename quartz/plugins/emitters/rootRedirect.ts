import { QuartzEmitterPlugin } from "../types"
import { write } from "./helpers"
import { FullSlug, resolveRelative } from "../../util/path"

type Options = {
  from: FullSlug
  to: FullSlug
}

export const RootRedirect: QuartzEmitterPlugin<Partial<Options>> = (userOpts) => {
  const opts: Options = {
    from: "filter" as FullSlug,
    to: "index" as FullSlug,
    ...userOpts,
  }

  return {
    name: "RootRedirect",
    async *emit(ctx) {
      const redirCandidate = resolveRelative(opts.from, opts.to)
      const redirUrl = redirCandidate === "." ? "../" : redirCandidate
      const content = `
        <!DOCTYPE html>
        <html lang="en-us">
        <head>
        <title>${opts.to}</title>
        <link rel="canonical" href="${redirUrl}">
        <meta name="robots" content="noindex">
        <meta charset="utf-8">
        <meta http-equiv="refresh" content="0; url=${redirUrl}">
        </head>
        </html>
        `

      yield write({
        ctx,
        content,
        slug: opts.from,
        ext: ".html",
      })
    },
  }
}
