import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

const sitemap = (): MetadataRoute.Sitemap => [
  { changeFrequency: "weekly", priority: 1, url: SITE_URL },
];

export default sitemap;
