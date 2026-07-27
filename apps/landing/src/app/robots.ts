import type { MetadataRoute } from "next";

const robots = (): MetadataRoute.Robots => ({
  rules: { allow: "/", userAgent: "*" },
  sitemap: "https://walletwright.dev/sitemap.xml",
});

export default robots;
