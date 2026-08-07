import { ButtonLink } from "@/components/button-link";
import { CodeBlock } from "@/components/code-block";
import { SectionHeading } from "@/components/section-heading";
import { GETTING_STARTED_URL } from "@/lib/site";

const SETUP_CODE = `// wallet-setup.ts
import type { WalletSetup } from "@walletwright/core";

export const metamask: WalletSetup = {
  wallet: "metamask",
  seedPhrase: "test test test test test test test test test test test junk",
  password: "Tester@1234",
};`;

const CodeExample = () => (
  <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-center">
      <div>
        <SectionHeading
          eyebrow="Setup"
          title="Onboard once, reuse everywhere."
          titleClassName="max-w-[24ch]"
        >
          Describe the wallet once, then build the cached profile with{" "}
          <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-[0.9em]">
            walletwright cache
          </code>{" "}
          or{" "}
          <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-[0.9em]">
            buildCache()
          </code>
          . Every test launches from a copy and unlocks in seconds.
        </SectionHeading>
        <div className="mt-8">
          <ButtonLink href={GETTING_STARTED_URL} variant="secondary">
            Read the getting-started guide
          </ButtonLink>
        </div>
      </div>

      <CodeBlock code={SETUP_CODE} filename="wallet-setup.ts" wrap />
    </div>
  </section>
);

export { CodeExample };
