import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site";
import { source } from "@/lib/source";

const sitemap = (): MetadataRoute.Sitemap =>
  source.getPages().map((page) => ({ url: `${SITE_ORIGIN}${page.url}` }));

export default sitemap;
