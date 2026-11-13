import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";

import type { ExtensionArchive } from "../types";

import { withArtifactLock } from "./cache-lock";
import { pathExists } from "./fs";

const ZIP_SIGNATURE = Buffer.from([80, 75, 3, 4]);

/**
 * Prefix for in-progress extractions. It has to live inside `cacheDir` so publishing is a `rename`
 * on one filesystem (a cross-device rename fails with EXDEV), and it starts with a dot so it can
 * never collide with a wallet's `name`.
 */
const STAGING_PREFIX = ".staging-";

/** An extension archive, and the cache directory it unpacks into. */
export type ExtensionDownload = ExtensionArchive & { cacheDir: string };

export const downloadAndExtractExtension = async (options: ExtensionDownload): Promise<string> => {
  const { cacheDir, format, name, sha256, url } = options;
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

  if (format === "crx") {
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

    return await withArtifactLock(outDir, async () => {
      if (await pathExists(path.join(outDir, "manifest.json"))) {
        return outDir;
      }

      await rm(outDir, { force: true, recursive: true });
      await rename(staging, outDir);

      return outDir;
    });
  } finally {
    await rm(staging, { force: true, recursive: true }).catch(() => {});
  }
};
