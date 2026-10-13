import tseslint from "typescript-eslint"

import reactHooks from "eslint-plugin-react-hooks"

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },

  ...tseslint.configs.recommended,

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
              message: "Persist?ncia remota pertence a uma etapa futura e ao backend.",
            },
          ],
        },
      ],
    },
  },
]
