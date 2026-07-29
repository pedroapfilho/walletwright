import { defineConfig } from "tsdown";

export default defineConfig({
  // Without this, hash-named chunks from every past build pile up in dist/ and ship in the tarball
  // (98 files / 2.8 MB unpacked, against 18 files for a clean build).
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/cli.ts", "src/chain.ts", "src/mock.ts", "src/mock-standard.ts"],
  format: "esm",
  minify: false,
  platform: "node",
  sourcemap: true,
  target: "es2022",
  treeshake: true,
});
