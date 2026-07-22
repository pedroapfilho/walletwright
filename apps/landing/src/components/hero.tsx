import { ButtonLink } from "@/components/button-link";
import { CodeBlock } from "@/components/code-block";
import { InstallCommand } from "@/components/install-command";
import { GETTING_STARTED_URL, GITHUB_URL } from "@/lib/site";

const HERO_CODE = `import { createWalletFixtures } from "walletwright";
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

const Hero = () => (
  <section className="mx-auto w-full max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
    <div className="flex flex-col items-center text-center">
      <p className="text-muted-foreground font-mono text-sm tracking-wide uppercase">
        Playwright wallet automation
      </p>

      <h1 className="mx-auto mt-5 max-w-[20ch] text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
        Connect and sign real wallets in Playwright.
      </h1>

      <p className="text-muted-foreground mx-auto mt-6 max-w-[60ch] text-lg text-pretty sm:text-xl">
        walletwright onboards MetaMask, Phantom, Rabby, Solflare, and Slush from a seed, caches the
        profile, then unlocks and clicks through the connect and signature popups against your dapp.
        It covers EVM, Solana, and Sui with the real extensions, not mocks.
      </p>

      <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
        <ButtonLink href={GETTING_STARTED_URL} variant="primary">
          Read the docs
        </ButtonLink>
        <ButtonLink href={GITHUB_URL} rel="noopener noreferrer" target="_blank" variant="secondary">
          View on GitHub
        </ButtonLink>
      </div>

      <div className="mt-8">
        <InstallCommand />
      </div>
    </div>

    <div className="mx-auto mt-16 max-w-3xl sm:mt-20">
      <CodeBlock code={HERO_CODE} filename="connect.spec.ts" />
    </div>
  </section>
);

export { Hero };
