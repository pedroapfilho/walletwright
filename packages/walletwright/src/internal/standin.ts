import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BrowserContext } from "@playwright/test";
import AdmZip from "adm-zip";

import type { WalletDefinition } from "../types";

const FIXTURE_DIR = fileURLToPath(new URL("standin", import.meta.url));
/** Longer than a respawned popup lives, shorter than an idle one, see `standin/extension`. */
const CLICK_TIMEOUT_MS = 5000;
const ANSWER_TIMEOUT_MS = 10_000;

/**
 * How the stand-in's approval popup behaves for one request: `ready` renders the request at once,
 * `late` opens blank and routes afterwards, `idle` shows the wallet's home before the request, and
 * `respawn` is replaced by a fresh window while its buttons are still disabled.
 */
export type ApprovalMode = "idle" | "late" | "ready" | "respawn";

export type Standin = {
  close: () => Promise<void>;
  /** A wallet driven entirely through the engine's interface, downloaded from this server. */
  definition: WalletDefinition;
  /** Open a dapp page that asks the stand-in for approval as it loads; `answer` awaits the reply. */
  request: (
    context: BrowserContext,
    mode: ApprovalMode,
  ) => Promise<{ answer: () => Promise<string | null> }>;
};

/** The profile directory a context runs on, as Chromium itself reports it. */
export const userDataDirOf = async (context: BrowserContext): Promise<string> => {
  const page = await context.newPage();
  await page.goto("chrome://version");
  const profilePath = await page.locator("#profile_path").textContent();
  await page.close();
  if (profilePath === null) {
    throw new Error("chrome://version reported no profile path");
  }
  return path.dirname(profilePath);
};

/** Serve the stand-in extension as a release archive, and a dapp that talks to it. Test-only. */
export const serveStandin = async (): Promise<Standin> => {
  const zip = new AdmZip();
  zip.addLocalFolder(path.join(FIXTURE_DIR, "extension"));
  const archive = zip.toBuffer();
  const files = new Map([
    ["/standin.zip", { body: archive, type: "application/zip" }],
    [
      "/dapp.html",
      { body: await readFile(path.join(FIXTURE_DIR, "dapp.html")), type: "text/html" },
    ],
  ]);

  const server = createServer((request, response) => {
    const file = files.get(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    if (file === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": file.type }).end(file.body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("stand-in server has no port");
  }
  const origin = `http://127.0.0.1:${address.port}`;
  const sha256 = createHash("sha256").update(archive).digest("hex");

  const definition: WalletDefinition = {
    approvalControls: (popup) => popup.getByRole("button", { name: /^(?:Approve|Reject)$/v }),
    approve: (popup) =>
      popup.getByRole("button", { name: "Approve" }).click({ timeout: CLICK_TIMEOUT_MS }),
    ecosystems: ["evm"],
    extensionName: "Stand-in",
    headlessApprovals: true,
    importWallet: async (page, seedPhrase, password) => {
      await page.getByLabel("Secret recovery phrase").fill(seedPhrase);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Import" }).click();
      await page.getByText("Wallet ready").waitFor();
    },
    onboardingPage: "onboarding.html",
    reject: (popup) =>
      popup.getByRole("button", { name: "Reject" }).click({ timeout: CLICK_TIMEOUT_MS }),
    source: {
      defaultVersion: "1.0.0",
      kind: "release",
      release: (version) => ({
        format: "zip",
        name: `standin-${version}`,
        sha256,
        url: `${origin}/standin.zip`,
      }),
    },
    unlockScreen: {
      entry: "home.html",
      isUnlocked: (page) => page.getByText("Unlocked", { exact: true }).isVisible(),
    },
  };

  const request: Standin["request"] = async (context, mode) => {
    const dapp = await context.newPage();
    await dapp.goto(`${origin}/dapp.html?mode=${mode}`);
    const answer = dapp.locator("#answer:not(:empty)");
    return {
      answer: async () => {
        await answer.waitFor({ timeout: ANSWER_TIMEOUT_MS });
        return answer.textContent();
      },
    };
  };

  const close = async (): Promise<void> => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  };

  return { close, definition, request };
};
