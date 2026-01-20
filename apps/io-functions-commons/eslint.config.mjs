import pagopa from "@pagopa/eslint-config";

export default [
  ...pagopa,
  {
    ignores: [
      "dist/**",
      "generated/**",
      "node_modules/**",
      "__integrations__/**",
      "__mocks__/**",
      "**/__tests__/**",
    ],
  },
  {
    rules: {
      ...pagopa[2].rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "max-lines-per-function": "off",
      "vitest/no-conditional-expect": "off",
    },
  },
];
