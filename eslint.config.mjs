import reactHooks from "eslint-plugin-react-hooks"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tseslint from "typescript-eslint"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "backend/**",
      "packages/**",
    ],
  },

  ...tseslint.configs.recommended,

  // Configuração global do Parser do TypeScript com tsconfigRootDir
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
      },
    },
  },

  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["*supabase*", "@prisma/*", "pg", "mysql*"],
              message: "Persistencia remota pertence a uma etapa futura e ao backend.",
            },
          ],
        },
      ],
    },
  },
]