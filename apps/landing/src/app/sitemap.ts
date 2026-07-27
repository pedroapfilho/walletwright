import type { MetadataRoute } from "next";

const sitemap = (): MetadataRoute.Sitemap => [
  { changeFrequency: "weekly", priority: 1, url: "https://walletwright.dev" },
];

export default sitemap;
