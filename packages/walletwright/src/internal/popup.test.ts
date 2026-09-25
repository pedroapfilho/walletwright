import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { isApprovalPopup } from "./popup";

const fakePage = (url: string, closed = false): Page =>
  ({ isClosed: () => closed, url: () => url }) as unknown as Page;

describe("isApprovalPopup", () => {
  const extensionId = "abc";

  it("is true for a matching extension id and token on an open page", () => {
    const page = fakePage("chrome-extension://abc/notification.html");
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(true);
  });

  it("is false when the extension id does not match", () => {
    const page = fakePage("chrome-extension://xyz/notification.html");
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(false);
  });

  it("is false when the match token is absent", () => {
    const page = fakePage("chrome-extension://abc/home.html");
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(false);
  });

  it("is false when the page is closed", () => {
    const page = fakePage("chrome-extension://abc/notification.html", true);
    expect(isApprovalPopup(page, extensionId, "notification.html")).toBe(false);
  });

  it("matches Slush's isPopup=1 single-page token", () => {
    const page = fakePage("chrome-extension://abc/index.html#/dapp?isPopup=1");
    expect(isApprovalPopup(page, extensionId, "isPopup=1")).toBe(true);
  });
});
