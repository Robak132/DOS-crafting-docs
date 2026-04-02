import { QuartzEmitterPlugin } from "../types"

export const ClientAuth: QuartzEmitterPlugin = () => ({
  name: "ClientAuth",
  getQuartzComponents: () => [],
  async emit() {
    // This plugin doesn't emit files, it just adds external resources
    return []
  },
  externalResources: () => {
    return {
      css: [
        {
          content: "./static/auth.css?v=1",
        },
      ],
      js: [
        {
          src: "./static/auth.js?v=3",
          loadTime: "beforeDOMReady",
          contentType: "external",
        },
      ],
    }
  },
})

