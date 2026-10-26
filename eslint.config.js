// SonarQube's JavaScript/TypeScript rules (SonarJS), run by ESLint: npm run lint:sonar
// The tools live in tools/sonar with their own TypeScript 5: neither the plugin nor the TypeScript parser
// can load the project's TypeScript 7. The parser reads tsconfig.json, so rules that need types get them.
import { createRequire } from "node:module"

const tools = createRequire(new URL("./tools/sonar/", import.meta.url))
const sonarjs = tools("eslint-plugin-sonarjs")
const tsParser = tools("@typescript-eslint/parser")

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: { jsx: true },
      },
    },
  },
  sonarjs.configs.recommended,
]
