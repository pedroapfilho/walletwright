import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

export const revalidate = false;

/**
 * Concatenates every page's processed Markdown into a single document an AI can
 * read in one fetch.
 */
export const GET = async () => {
  const pages = source.getPages();
  const results = await Promise.allSettled(pages.map(getLLMText));
  const scanned = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }
    console.warn(`[walletwright docs] llms-full.txt skipped ${pages[index]?.url}`, result.reason);
    return [];
  });

  if (pages.length > 0 && scanned.length === 0) {
    throw new Error("llms-full.txt: every page conversion failed");
  }

  return new Response(scanned.join("\n\n"));
};
