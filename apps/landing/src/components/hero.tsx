import { ButtonLink } from "@/components/button-link";
import { CodeBlock } from "@/components/code-block";
import { InstallCommand } from "@/components/install-command";
import { GETTING_STARTED_URL, GITHUB_URL } from "@/lib/site";

const HERO_CODE = `import { createWalletFixtures } from "@walletwright/core";
import { metamask } from "./wallet-setup";

const test = createWalletFixtures(metamask);
const { expect } = test;

test("connect and sign", async ({ page, wallet }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Connect" }).click();
  await wallet.connectToDapp();
  await expect(page.locator("#account")).toContainText("0x");

  await page.getByRole("button", { name: "Sign" }).click();
  await wallet.confirmSignature();
});`;

const GREEN = "\u001b[32m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";

const pass = (index: number, spec: string, name: string, duration: string) =>
  `  ${GREEN}✓${RESET}  ${index} [chromium] › tests/${spec} › ${name} ${DIM}(${duration})${RESET}`;

/*
 * Verbatim output of a real local run against the demo dapp, not a mock-up.
 * Re-capture it rather than editing timings by hand if this ever goes stale.
 */
const RUN_OUTPUT = [
  `${DIM}$${RESET} pnpm exec playwright test metamask.spec.ts phantom.spec.ts rabby.spec.ts solflare.spec.ts`,
  "",
  "Running 4 tests using 1 worker",
  "",
  pass(1, "metamask.spec.ts:8:1", "MetaMask: connect wallet and sign a message", "6.5s"),
  pass(2, "phantom.spec.ts:6:1", "Phantom: connect + sign on EVM and Solana", "18.2s"),
  pass(3, "rabby.spec.ts:8:1", "Rabby: connect wallet and sign a message", "5.5s"),
  pass(4, "solflare.spec.ts:6:1", "Solflare: connect + sign on Solana", "4.1s"),
  "",
  `  ${GREEN}4 passed${RESET}${DIM} (34.7s)${RESET}`,
].join("\n");

const Hero = () => (
  <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-12 sm:pt-28 sm:pb-16">
    <div className="flex flex-col items-center text-center">
      <p className="text-brand font-mono text-xs tracking-[0.14em] uppercase">
        Playwright wallet automation
      </p>

      <h1 className="mx-auto mt-5 max-w-[20ch] text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
        Connect and sign real wallets in Playwright.
      </h1>

      <p className="text-muted-foreground mx-auto mt-6 max-w-[60ch] text-lg text-pretty sm:text-xl">
        walletwright onboards MetaMask, Phantom, Rabby, Solflare, and Slush from a seed, caches the
        profile, then unlocks and drives the connect and signature popups against your dapp.
      </p>

      <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
        <ButtonLink href={GETTING_STARTED_URL} variant="primary">
          Get started
        </ButtonLink>
        <ButtonLink href={GITHUB_URL} rel="noopener noreferrer" target="_blank" variant="secondary">
          View on GitHub
        </ButtonLink>
      </div>

      {/* `max-w-full` on the pill only bites if this wrapper is width-constrained. */}
      <div className="mt-8 flex w-full justify-center">
        <InstallCommand />
      </div>
    </div>

    <div className="mx-auto mt-12 max-w-3xl space-y-4 sm:mt-16">
      <CodeBlock code={HERO_CODE} filename="connect.spec.ts" />
      <CodeBlock code={RUN_OUTPUT} label="Test run output" lang="ansi" wrap />
    </div>
  </section>
);

export { Hero };
