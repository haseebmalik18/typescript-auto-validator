import { defineConfig } from "vite";
import typescriptValidator from "../../src/plugin/vite-plugin.js";

export default defineConfig({
  plugins: [
    typescriptValidator({
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts"],
      outputDir: "src/generated",
      generateTypeGuards: true,
      watchMode: true,
    }),
  ],
  build: {
    target: "esnext",
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: "main",
    },
    rollupOptions: {
      external: ["typescript-runtime-validator"],
    },
  },
});
