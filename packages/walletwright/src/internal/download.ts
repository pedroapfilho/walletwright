import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";

const ZIP_SIGNATURE = Buffer.from([80, 75, 3, 4]);

/**
 * Prefix for in-progress extractions. It has to live inside `cacheDir` so publishing is a `rename`
 * on one filesystem (a cross-device rename fails with EXDEV), and it starts with a dot so it can
 * never collide with a wallet's `name`.
 */
const STAGING_PREFIX = ".staging-";

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

/** Download and validate an extension archive, then publish its extraction atomically from staging. */
export const downloadAndExtractExtension = async (options: {
  cacheDir: string;
  kind: "zip" | "crx";
  name: string;
  /**
   * Expected sha256 of the downloaded bytes. Required, and `undefined` only where the bytes genuinely
   * cannot be pinned, so adding a download site forces a decision instead of quietly trusting it.
   */
  sha256: string | undefined;
  url: string;
}): Promise<string> => {
  const { cacheDir, kind, name, sha256, url } = options;
  const cacheRoot = path.resolve(cacheDir);
  const outDir = path.resolve(cacheDir, name);
  if (outDir === cacheRoot || !outDir.startsWith(cacheRoot + path.sep)) {
    throw new Error(`[walletwright] invalid extension name: ${name}`);
  }
  if (await pathExists(path.join(outDir, "manifest.json"))) {
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

  if (sha256 !== undefined) {
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== sha256.toLowerCase()) {
      throw new Error(
        `[walletwright] ${name} failed integrity check: expected ${sha256}, got ${actual}`,
      );
    }
  }

  let zipBytes = bytes;
  if (kind === "crx") {
    const start = bytes.indexOf(ZIP_SIGNATURE);
    if (start === -1) {
      throw new Error(`[walletwright] ${url} is not a valid CRX (no ZIP header found)`);
    }
    zipBytes = bytes.subarray(start);
  }

  const staging = await mkdtemp(path.join(cacheRoot, STAGING_PREFIX));
  try {
    const zip = new AdmZip(zipBytes);
    for (const entry of zip.getEntries()) {
      const target = path.resolve(staging, entry.entryName);
      if (target !== staging && !target.startsWith(staging + path.sep)) {
        throw new Error(`[walletwright] refusing to extract ${entry.entryName}: escapes ${outDir}`);
      }
    }
    zip.extractAllTo(staging, /* overwrite */ true);

    if (!(await pathExists(path.join(staging, "manifest.json")))) {
      throw new Error(`[walletwright] extracted ${name} but no manifest.json found in ${outDir}`);
    }

    if (await pathExists(path.join(outDir, "manifest.json"))) {
      return outDir; // another worker published while we were downloading
    }
    await rm(outDir, { force: true, recursive: true });
    await rename(staging, outDir);
    return outDir;
  } finally {
    await rm(staging, { force: true, recursive: true }).catch(() => {});
  }
};

/** Build the Chrome Web Store CRX download URL for an extension id. */
export const chromeWebStoreCrxUrl = (extensionId: string): string =>
  `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;

/** Download and extract a Chrome Web Store extension (latest) into `<cacheDir>/<name>`. */
export const prepareWebStoreExtension = (options: {
  cacheDir: string;
  extensionId: string;
  name: string;
}): Promise<string> =>
  downloadAndExtractExtension({
    cacheDir: options.cacheDir,
    kind: "crx",
    name: options.name,
    sha256: undefined,
    url: chromeWebStoreCrxUrl(options.extensionId),
  });
