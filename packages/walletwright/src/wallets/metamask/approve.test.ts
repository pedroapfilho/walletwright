import type { Browser, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { staleConnectPage } from "./approve";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
});

/** A page at `notification.html<hash>` showing MetaMask's Connect button, and how often it loaded. */
const popupAt = async (hash: string, connect: "disabled" | "enabled") => {
  const page: Page = await browser.newPage();
  let loads = 0;

  await page.route("http://metamask.test/**", (route) => {
    loads += 1;

    return route.fulfill({
      body: `<button data-testid="confirm-btn" ${connect === "disabled" ? "disabled" : ""}>Connect</button>`,
      contentType: "text/html",
    });
  });
  await page.goto(`http://metamask.test/notification.html${hash}`);

  return { loads: () => loads, popup: page };
};

describe("staleConnectPage", () => {
  it("reloads a connect page whose Connect stays disabled", async () => {
    const { loads, popup } = await popupAt("#/connect/abc", "disabled");

    expect(await staleConnectPage.shows(popup)).toBe(true);
    await staleConnectPage.pass(popup);

    expect(loads()).toBe(2);
  });

  it("does not show once Connect is enabled", async () => {
    const { popup } = await popupAt("#/connect/abc", "enabled");

    expect(await staleConnectPage.shows(popup)).toBe(false);
  });

  it("leaves a connect page alone when Connect enables within the grace period", async () => {
    const { loads, popup } = await popupAt("#/connect/abc", "enabled");

    await staleConnectPage.pass(popup);

    expect(loads()).toBe(1);
  });

  it("never shows on a signature or transaction page, where a disabled confirm is still working", async () => {
    const { popup } = await popupAt("#/confirm-transaction/abc", "disabled");

    expect(await staleConnectPage.shows(popup)).toBe(false);
  });
});
