import { ButtonLink } from "@/components/button-link";
import { CodeBlock } from "@/components/code-block";
import { Eyebrow } from "@/components/eyebrow";
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
const RESET = "\u001b[0m";

const pass = (index: number, spec: string, name: string, duration: string) =>
  `  ${GREEN}✓${RESET}  ${index} [chromium] › tests/${spec} › ${name} (${duration})`;

/*
 * A real local run against the demo dapp, minus Playwright's dim (SGR 2) runs:
 * shiki renders those at 50% alpha, which fails WCAG AA on the light theme.
 * Re-capture it rather than editing timings by hand if this goes stale.
 */
const RUN_OUTPUT = [
  "$ pnpm exec playwright test metamask.spec.ts phantom.spec.ts rabby.spec.ts solflare.spec.ts",
  "",
  "Running 4 tests using 1 worker",
  "",
  pass(1, "metamask.spec.ts:8:1", "MetaMask: connect wallet and sign a message", "6.5s"),
  pass(2, "phantom.spec.ts:6:1", "Phantom: connect + sign on EVM and Solana", "18.2s"),
  pass(3, "rabby.spec.ts:8:1", "Rabby: connect wallet and sign a message", "5.5s"),
  pass(4, "solflare.spec.ts:6:1", "Solflare: connect + sign on Solana", "4.1s"),
  "",
  `  ${GREEN}4 passed${RESET} (34.7s)`,
].join("\n");

const Hero = () => (
  <section className="border-border relative isolate overflow-hidden border-b">
    <div aria-hidden="true" className="grid-backdrop pointer-events-none absolute inset-0 -z-10" />

    <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16 sm:pt-24 sm:pb-24">
      <div className="grid items-center gap-x-8 gap-y-12 lg:grid-cols-2">
        <div>
          <Eyebrow>Playwright wallet automation</Eyebrow>

          <h1 className="mt-4 max-w-[24ch] text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Connect and sign real wallets in Playwright.
          </h1>

          <p className="text-muted-foreground mt-6 max-w-[48ch] text-lg text-pretty">
            walletwright onboards MetaMask, Phantom, Rabby, Solflare, and Slush from a seed, caches
            the profile, then unlocks and drives the connect and signature popups against your dapp.
          </p>

          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <ButtonLink href={GETTING_STARTED_URL} variant="primary">
              Get started
            </ButtonLink>
            <ButtonLink
              href={GITHUB_URL}
              rel="noopener noreferrer"
              target="_blank"
              variant="secondary"
            >
              View on GitHub
            </ButtonLink>
          </div>

          <div className="mt-6 flex">
            <InstallCommand />
          </div>
        </div>

        <CodeBlock code={HERO_CODE} filename="connect.spec.ts" />
      </div>

      <div className="mt-12 sm:mt-16">
        <p className="text-muted-foreground font-mono text-base sm:text-sm">
          Four wallets, one command, real approval popups.
        </p>
        <div className="mt-4">
          <CodeBlock code={RUN_OUTPUT} label="Test run output" lang="ansi" wrap />
        </div>
      </div>
    </div>
  </section>
);

export { Hero };
