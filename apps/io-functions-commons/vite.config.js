import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/__test__/**", ".pnp.cjs", ".pnp.loader.mjs"],
    },
    exclude: [...configDefaults.exclude, "lib/**"],
  },
});
