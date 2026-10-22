import type { Browser, BrowserContext, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { BridgeCall } from "./page-bridge";
import { installPageBridge } from "./page-bridge";

type Probe = { call: BridgeCall<string, string>; uuid: string };

type ProbeWindow = Window & { probes?: Record<string, Probe> };

const mountProbe = (call: Probe["call"], name: string, uuid: string) => {
  // SAFETY: a test-only global the specs read back through page.evaluate.
  const probeWindow = window as ProbeWindow;
  probeWindow.probes = { ...probeWindow.probes, [name]: { call, uuid } };
};

const installProbe = (target: BrowserContext | Page, name: string, handle: Probe["call"]) =>
  installPageBridge(target, { data: name, handle, mount: mountProbe });

const openPage = async (context: BrowserContext) => {
  const page = await context.newPage();
  await page.goto("data:text/html,<title>bridge</title>");

  return page;
};

describe("installPageBridge", () => {
  let browser: Browser;
  let context: BrowserContext;

  beforeAll(async () => {
    browser = await chromium.launch();
  }, 30_000);

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext();
  });

  afterEach(async () => {
    await context.close();
  });

  it("answers an in-page call with the Node handler's result", async () => {
    await installProbe(context, "echo", (request) => Promise.resolve(`node:${request}`));
    const page = await openPage(context);

    const answer = await page.evaluate(() =>
      (window as ProbeWindow).probes?.echo?.call("from the page"),
    );

    expect(answer).toBe("node:from the page");
  });

  it("keeps two installs on one context apart, each with its own handler and uuid", async () => {
    await installProbe(context, "first", (request) => Promise.resolve(`first:${request}`));
    await installProbe(context, "second", (request) => Promise.resolve(`second:${request}`));
    const page = await openPage(context);

    const probes = await page.evaluate(async () => {
      const { first, second } = (window as ProbeWindow).probes ?? {};

      return {
        answers: await Promise.all([first?.call("x"), second?.call("x")]),
        uuids: [first?.uuid, second?.uuid],
      };
    });

    expect(probes.answers).toEqual(["first:x", "second:x"]);
    const [firstUuid, secondUuid] = probes.uuids;
    expect(firstUuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/v);
    expect(secondUuid).not.toBe(firstUuid);
  });

  it("rejects the in-page call when the Node handler rejects", async () => {
    await installProbe(context, "failing", () =>
      Promise.reject(new Error("[test] handler failed")),
    );
    const page = await openPage(context);

    const outcome = await page.evaluate(() =>
      (window as ProbeWindow).probes?.failing?.call("x").then(() => "resolved", String),
    );

    expect(outcome).toContain("[test] handler failed");
  });
});
