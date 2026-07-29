import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "lcov"],
      // Floors, not targets: they sit at what the suite reaches, so a drop
      // fails the build. What keeps them off 100% is three defensive returns
      // for a parser that throws or emits a node without offsets, which no
      // real parser in the test set does.
      thresholds: {
        statements: 96,
        branches: 92,
        functions: 100,
        lines: 95,
      },
    },
  },
});
