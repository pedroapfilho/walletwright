import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, it } from "vitest";

import { build } from "./cache";
import { runDirectly } from "./controller";
import { launch } from "./launch";
import type { EngineSetup } from "./profile";
import { type Standin, serveStandin } from "./standin";

let standin: Standin;
let setup: EngineSetup;

beforeAll(async () => {
  standin = await serveStandin();
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "walletwright-approval-test-"));
  setup = {
    cacheDir,
    password: "stand-in-password",
    seedPhrase: "stand in seed",
    wallet: "standin",
  };
  await build(standin.definition, setup, { headless: true });
}, 60_000);

afterAll(async () => {
  await standin.close();

  if (setup.cacheDir !== undefined) {
    await rm(setup.cacheDir, { force: true, recursive: true });
  }
});

const launchStandin = () =>
  launch(standin.definition, setup, { headless: true, step: runDirectly });

describe.concurrent("wallet approvals", { timeout: 60_000 }, () => {
  it("approves a popup that opens blank and routes late", async ({ expect }) => {
    await using launched = await launchStandin();
    const dapp = await standin.request(launched.context, "late");

    await launched.wallet.approve();

    expect(await dapp.answer()).toBe("approved");
  });

  it("rejects the pending request", async ({ expect }) => {
    await using launched = await launchStandin();
    const dapp = await standin.request(launched.context, "ready");

    await launched.wallet.reject();

    expect(await dapp.answer()).toBe("rejected");
  });

  it("waits past the wallet's idle screen for its declared approval controls", async ({
    expect,
  }) => {
    await using launched = await launchStandin();
    const dapp = await standin.request(launched.context, "idle");

    await launched.wallet.approve();

    expect(await dapp.answer()).toBe("approved");
  });

  it("re-acquires a popup the wallet respawns mid-approval", async ({ expect }) => {
    await using launched = await launchStandin();
    const dapp = await standin.request(launched.context, "respawn");

    await launched.wallet.approve();

    expect(await dapp.answer()).toBe("approved");
  });

  it("clicks each control of a multi-screen approval once", async ({ expect }) => {
    await using launched = await launchStandin();
    const dapp = await standin.request(launched.context, "steps");

    await launched.wallet.confirmSignature();

    expect(await dapp.answer()).toBe("approved");
  });

  it("re-authenticates through the unlock flow when the window asks for the password", async ({
    expect,
  }) => {
    await using launched = await launchStandin();
    const dapp = await standin.request(launched.context, "reauth");

    await launched.wallet.confirmSignature();

    expect(await dapp.answer()).toBe("approved");
  });

  it("fails when the window keeps asking for the password", async ({ expect }) => {
    await using launched = await launchStandin();
    await standin.request(launched.context, "refuse");

    await expect(launched.wallet.confirmSignature()).rejects.toThrow(
      "[walletwright] Stand-in did not take the password",
    );
  });

  it("passes a screen the wallet declares before clicking the request", async ({ expect }) => {
    await using launched = await launchStandin();
    const dapp = await standin.request(launched.context, "notice");

    await launched.wallet.approve();

    expect(await dapp.answer()).toBe("approved");
  });

  it("throws when a required popup never appears", async ({ expect }) => {
    await using launched = await launchStandin();

    await expect(launched.wallet.approve()).rejects.toThrow(
      "[walletwright] Stand-in's approval window did not appear (gave up after 30s)",
    );
  });

  it("resolves an optional approval that never appears", async ({ expect }) => {
    await using launched = await launchStandin();

    await expect(launched.wallet.connectToDapp({ optional: true })).resolves.toBeUndefined();
  });
});
