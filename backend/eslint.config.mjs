import tseslint from "typescript-eslint"
export default [
  { ignores: ["src/generated/**", "dist/**", ".test-build/**"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]
