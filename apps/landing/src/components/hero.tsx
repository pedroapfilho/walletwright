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
  <section className="wallet-lab-grid border-border/60 border-b">
    <div className="mx-auto w-full max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
      <div className="grid gap-12 lg:grid-cols-[9fr_11fr] lg:items-center">
        <div>
          <p className="text-brand font-mono text-xs tracking-[0.14em] uppercase">
            Playwright wallet automation
          </p>

          <h1 className="mt-5 max-w-[20ch] text-4xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Connect and sign real wallets in Playwright.
          </h1>

          <p className="text-muted-foreground mt-6 max-w-[48ch] text-lg text-pretty sm:text-xl">
            walletwright onboards MetaMask, Phantom, Rabby, Solflare, and Slush from a seed, caches
            the profile, then unlocks and drives the connect and signature popups against your dapp.
          </p>

          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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

          <div className="mt-8 flex w-full">
            <InstallCommand />
          </div>
        </div>

        <div className="border-border bg-card shadow-card rounded-xl border p-3 sm:p-4">
          <div className="text-muted-foreground flex items-center justify-between px-1 pb-3 font-mono text-xs">
            <span>approval run</span>
            <span className="text-brand tabular-nums">4 checks passed</span>
          </div>
          <ol
            aria-label="Wallet test sequence"
            className="border-border mb-3 grid overflow-hidden rounded-lg border sm:grid-cols-2"
          >
            {["Cache profile", "Open dapp", "Approve popup", "Assert result"].map((step, index) => (
              <li
                className="border-border flex items-center gap-3 border-b p-3 text-base last:border-b-0 sm:border-r sm:text-sm sm:odd:border-r sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-child(4)]:border-r-0 sm:[&:nth-child(4)]:border-b-0"
                key={step}
              >
                <span className="text-brand font-mono tabular-nums">0{index + 1}</span>
                <span>{step}</span>
                <span aria-hidden="true" className="text-brand ml-auto">
                  ✓
                </span>
              </li>
            ))}
          </ol>
          <CodeBlock code={RUN_OUTPUT} label="Test run output" lang="ansi" wrap />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-3xl sm:mt-16">
        <CodeBlock code={HERO_CODE} filename="connect.spec.ts" />
      </div>
    </div>
  </section>
);

export { Hero };
