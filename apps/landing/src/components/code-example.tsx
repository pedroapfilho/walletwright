import { ButtonLink } from "@/components/button-link";
import { CodeBlock } from "@/components/code-block";
import { Section } from "@/components/section";
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
  <Section>
    <div className="grid grid-cols-1 items-center gap-x-8 gap-y-12 lg:grid-cols-2">
      <div>
        <SectionHeading eyebrow="Setup" title="Onboard once, reuse everywhere.">
          Describe the wallet once, then build the cached profile with{" "}
          <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono">walletwright cache</code> or{" "}
          <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono">buildCache()</code>. Every
          test launches from a copy and unlocks in seconds.
        </SectionHeading>
        <div className="mt-8">
          <ButtonLink href={GETTING_STARTED_URL} variant="secondary">
            Read the getting-started guide
          </ButtonLink>
        </div>
      </div>

      <CodeBlock code={SETUP_CODE} filename="wallet-setup.ts" wrap />
    </div>
  </Section>
);

export { CodeExample };
