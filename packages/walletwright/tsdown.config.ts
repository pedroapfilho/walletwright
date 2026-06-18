import { defineConfig } from "tsdown";

export default defineConfig({
  clean: false,
  dts: true,
  entry: ["src/index.ts", "src/cli.ts"],
  format: "esm",
  minify: false,
  platform: "node",
  sourcemap: true,
  target: "es2022",
  treeshake: true,
});
