import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";

// ZIP local-file-header signature ("PK\x03\x04") as decimal bytes. It marks where the embedded ZIP
// begins inside a CRX. Decimal (not hex) avoids the oxfmt/number-literal-case casing conflict.
const ZIP_SIGNATURE = Buffer.from([80, 75, 3, 4]);

/**
 * Download an extension archive and extract it to `<cacheDir>/<name>`, returning that path. A `.crx`
 * is a ZIP with a binary header, we slice from the ZIP signature before unzipping. Reuses an
 * existing extraction (so you can pre-place the extension to skip the download).
 */
export const downloadAndExtractExtension = async (options: {
  cacheDir: string;
  kind: "zip" | "crx";
  name: string;
  url: string;
}): Promise<string> => {
  const { cacheDir, kind, name, url } = options;
  const outDir = path.resolve(cacheDir, name);
  if (existsSync(path.join(outDir, "manifest.json"))) {
    return outDir;
  }

  await mkdir(cacheDir, { recursive: true });

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `[walletwright] failed to download ${url}: ${response.status} ${response.statusText}`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());

  let zipBytes = bytes;
  if (kind === "crx") {
    const start = bytes.indexOf(ZIP_SIGNATURE);
    if (start === -1) {
      throw new Error(`[walletwright] ${url} is not a valid CRX (no ZIP header found)`);
    }
    zipBytes = bytes.subarray(start);
  }

  await rm(outDir, { force: true, recursive: true });
  const zip = new AdmZip(zipBytes);
  const root = path.resolve(outDir);
  for (const entry of zip.getEntries()) {
    const target = path.resolve(root, entry.entryName);
    // Reject zip-slip: an entry like "../../x" must not resolve outside the extraction root.
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`[walletwright] refusing to extract ${entry.entryName}: escapes ${outDir}`);
    }
  }
  zip.extractAllTo(outDir, /* overwrite */ true);

  if (!existsSync(path.join(outDir, "manifest.json"))) {
    throw new Error(`[walletwright] extracted ${name} but no manifest.json found in ${outDir}`);
  }
  return outDir;
};
