import { defineConfig } from "vite";

export default defineConfig({
  server: { allowedHosts: [".localhost"], port: 3000 },
});
