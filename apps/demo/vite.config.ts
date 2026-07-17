import { resolve } from "node:path";

import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        privy: resolve(import.meta.dirname, "privy.html"),
      },
    },
  },
  server: { port: 3000 },
});
