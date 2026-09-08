import assert from "node:assert/strict";
import { test } from "node:test";

import type { WalletKind } from "@walletwright/core";

import { buildCaches } from "./build-caches";

const noop = () => {};

const createGate = () => {
  let resolve = noop;
  const promise = new Promise<void>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
};

void test("starts independent wallets together and never races duplicate selections", async () => {
  const gate = createGate();
  const started: Array<WalletKind> = [];
  const work = buildCaches(["metamask", "phantom", "metamask"], async (name) => {
    started.push(name);
    await gate.promise;
  });
  assert.deepEqual(started, ["metamask", "phantom"]);
  gate.resolve();
  await work;
});

void test("waits for other wallets to clean up before reporting a failure", async () => {
  const gate = createGate();
  const failure = new Error("onboarding failed");
  let cleanedUp = false;
  let settled = false;
  const work = buildCaches(["metamask", "phantom"], async (name) => {
    if (name === "metamask") {
      throw failure;
    }
    await gate.promise;
    cleanedUp = true;
  });
  const rejected = assert.rejects(work, (error: Error) => {
    settled = true;
    assert.equal(cleanedUp, true);
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [failure]);
    return true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  gate.resolve();
  await rejected;
});

void test("isolates Slush before starting other wallets and deduplicates its profile", async () => {
  const gate = createGate();
  const started: Array<WalletKind> = [];
  const work = buildCaches(["metamask", "slush", "phantom", "slush"], async (name) => {
    started.push(name);
    if (name === "slush") {
      await gate.promise;
    }
  });
  assert.deepEqual(started, ["slush"]);
  gate.resolve();
  await work;
  assert.deepEqual(started, ["slush", "metamask", "phantom"]);
});

void test("propagates isolated onboarding failure before any other browser opens", async () => {
  const failure = new Error("Slush onboarding failed");
  const started: Array<WalletKind> = [];
  await assert.rejects(
    buildCaches(["metamask", "slush"], (name) => {
      started.push(name);
      return Promise.reject(failure);
    }),
    failure,
  );
  assert.deepEqual(started, ["slush"]);
});
