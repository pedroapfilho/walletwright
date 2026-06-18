import { ButtonLink } from "@/components/button-link";
import { CodeBlock } from "@/components/code-block";
import { GETTING_STARTED_URL } from "@/lib/site";

const SETUP_CODE = `// wallet-setup.ts
import type { WalletSetup } from "walletwright";

export const metamask: WalletSetup = {
  wallet: "metamask",
  seedPhrase: "test test test test test test test test test test test junk",
  password: "Tester@1234",
};`;

const CodeExample = () => (
  <section className="border-border bg-muted/40 border-y">
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
      <div>
        <h2 className="max-w-[24ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Onboard once, reuse everywhere.
        </h2>
        <p className="text-muted-foreground mt-4 max-w-[56ch] text-lg text-pretty">
          Describe the wallet once, then build the cached profile with{" "}
          <code className="bg-card rounded-sm px-1.5 py-0.5 font-mono text-[0.9em]">
            walletwright cache
          </code>{" "}
          or{" "}
          <code className="bg-card rounded-sm px-1.5 py-0.5 font-mono text-[0.9em]">
            buildCache()
          </code>
          . Every test launches from a copy and unlocks in seconds.
        </p>
        <div className="mt-8">
          <ButtonLink href={GETTING_STARTED_URL} variant="secondary">
            Read the getting-started guide
          </ButtonLink>
        </div>
      </div>

      <CodeBlock code={SETUP_CODE} filename="wallet-setup.ts" />
    </div>
  </section>
);

export { CodeExample };
