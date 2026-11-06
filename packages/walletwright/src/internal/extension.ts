import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { ExtensionArchive, WalletDefinition } from "../types";

const chromeWebStoreCrxUrl = (extensionId: string): string =>
  `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;

/**
 * The archive a setup runs. A release source honours `version`; a Web Store source cannot pin one,
 * so asking for it is an error rather than a setting that forks the profile cache for the same build.
 */
export const extensionArchive = (
  { extensionName, source }: Pick<WalletDefinition, "extensionName" | "source">,
  version: string | undefined,
): ExtensionArchive => {
  if (source.kind === "release") {
    return source.release(version ?? source.defaultVersion);
  }

  if (version !== undefined) {
    throw new Error(
      `[walletwright] ${extensionName} runs its Chrome Web Store build, which cannot be pinned; remove \`version\` from its WalletSetup.`,
    );
  }

  return {
    format: "crx",
    name: `webstore-${source.id}`,
    sha256: undefined,
    url: chromeWebStoreCrxUrl(source.id),
  };
};

const manifestSchema = z.object({ key: z.string().optional() });

/**
 * Mirror Chrome's extension-id derivation for an unpacked extension: the manifest's public `key` if
 * it has one, otherwise the real path, since Chrome hashes the path with symlinks resolved.
 */
export const extensionIdFromPath = async (extensionPath: string): Promise<string> => {
  const abs = await realpath(path.resolve(extensionPath));
  const text = await readFile(path.join(abs, "manifest.json"), "utf8");
  const { key } = manifestSchema.parse(JSON.parse(text));

  const source =
    key === undefined || key === "" ? Buffer.from(abs, "utf8") : Buffer.from(key, "base64");

  const hex = createHash("sha256").update(source).digest("hex").slice(0, 32);

  return Array.from(hex, (nibble) => String.fromCodePoint(97 + Number.parseInt(nibble, 16))).join(
    "",
  );
};
