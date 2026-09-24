import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { ExtensionArchive, WalletSetup } from "../types";
import { wallets } from "../wallets/index";

import { chromeWebStoreCrxUrl, downloadAndExtractExtension } from "./download";

/**
 * The archive a setup runs. A release source honours `version`; a Web Store source cannot pin one,
 * so asking for it is an error rather than a setting that forks the profile cache for the same build.
 */
export const extensionArchive = (setup: WalletSetup): ExtensionArchive => {
  const { extensionName, source } = wallets[setup.wallet];
  if (source.kind === "release") {
    return source.release(setup.version ?? source.defaultVersion);
  }
  if (setup.version !== undefined) {
    throw new Error(
      `[walletwright] ${extensionName} runs its Chrome Web Store build, which cannot be pinned; remove \`version\` from its WalletSetup.`,
    );
  }
  return {
    format: "crx",
    name: `${setup.wallet}-chrome-latest`,
    sha256: undefined,
    url: chromeWebStoreCrxUrl(source.id),
  };
};

/** Download and unpack the setup's extension into `cacheDir`, returning its path. */
export const prepareExtension = async (setup: WalletSetup, cacheDir: string): Promise<string> => {
  const extensionPath = await downloadAndExtractExtension({ cacheDir, ...extensionArchive(setup) });
  return extensionPath;
};

/** Mirror Chrome's extension-id derivation; resolve symlinks because Chrome hashes the real path. */
export const extensionIdFromPath = async (extensionPath: string): Promise<string> => {
  const resolved = path.resolve(extensionPath);
  let abs = resolved;
  try {
    abs = await realpath(resolved);
  } catch {
    abs = resolved;
  }
  let key: string | undefined;
  try {
    const text = await readFile(path.join(abs, "manifest.json"), "utf8");
    const manifest = z.object({ key: z.string().optional() }).parse(JSON.parse(text));
    key = manifest.key;
  } catch {
    key = undefined;
  }
  const source =
    key === undefined || key === "" ? Buffer.from(abs, "utf8") : Buffer.from(key, "base64");
  const hex = createHash("sha256").update(source).digest("hex").slice(0, 32);
  return Array.from(hex, (nibble) => String.fromCodePoint(97 + Number.parseInt(nibble, 16))).join(
    "",
  );
};
