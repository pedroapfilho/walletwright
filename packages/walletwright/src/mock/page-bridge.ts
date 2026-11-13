import { randomUUID } from "node:crypto";

import type { BrowserContext, Page } from "@playwright/test";

type BridgeCall<Request, Response> = (request: Request) => Promise<Response>;

type PageBridge<Request, Response, Data> = {
  /** JSON-serializable data handed to `mount`. */
  data: Data;
  /** Answers each in-page call in Node. Its result must be JSON-serializable. */
  handle: BridgeCall<Request, Response>;
  /**
   * Installs the in-page provider before any page script runs. Playwright serializes it into the
   * page, so it may use only its arguments and page globals, never anything from its Node module.
   */
  mount: (call: BridgeCall<Request, Response>, data: Data, uuid: string) => void;
};

/**
 * Connect a Node handler to an in-page provider on a context (every page) or a single page. Each
 * install gets its own Playwright binding and UUIDv4, so installing twice on one target never
 * collides: Playwright refuses a binding name it has already registered.
 */
const installPageBridge = async <Request, Response, Data>(
  target: BrowserContext | Page,
  { data, handle, mount }: PageBridge<Request, Response, Data>,
): Promise<void> => {
  const uuid = randomUUID();
  const binding = `__walletwrightBridge_${uuid.replaceAll("-", "")}`;
  await target.exposeFunction(binding, handle);
  // The same serialization Playwright applies to `addInitScript(fn, arg)`, with the binding as an
  // extra argument, since it exists only in the page.
  await target.addInitScript(
    `(${mount.toString()})(window[${JSON.stringify(binding)}], ${JSON.stringify(data)}, ${JSON.stringify(uuid)});`,
  );
};

export { installPageBridge };

export type { BridgeCall };
