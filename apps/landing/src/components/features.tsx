import {
  BeakerIcon,
  CircleStackIcon,
  CubeTransparentIcon,
  PuzzlePieceIcon,
  ServerStackIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";

type Feature = {
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
};

const FEATURES: Array<Feature> = [
  {
    description:
      "The actual MetaMask, Phantom, Rabby, Solflare, and Slush builds, loaded unpacked into Chromium, with no mocked providers.",
    icon: PuzzlePieceIcon,
    title: "Real extensions",
  },
  {
    description:
      "buildCache imports the seed into a profile on disk once. Tests launch from a copy and only unlock, so every run starts in seconds.",
    icon: CircleStackIcon,
    title: "Onboard once, cache it",
  },
  {
    description:
      "connectToDapp() and confirmSignature() drive MetaMask, Phantom, Rabby, and Solflare on EVM and Solana, and Slush on Sui, the same way.",
    icon: CubeTransparentIcon,
    title: "EVM, Solana, and Sui, one API",
  },
  {
    description:
      "createWalletFixtures returns a @playwright/test test with a wallet fixture. No framework lock-in, you control the Playwright version.",
    icon: BeakerIcon,
    title: "Plain Playwright fixtures",
  },
  {
    description:
      "Approval popups open headed, so run under xvfb on CI. Cache building can run headless, and a couple of retries keeps runs stable.",
    icon: ServerStackIcon,
    title: "CI-ready, headed",
  },
  {
    description:
      "Built on current wallet and Chromium versions, with no fork and no dependency overrides to maintain.",
    icon: ShieldCheckIcon,
    title: "Current versions, no fork",
  },
];

const Features = () => (
  <Section className="border-border border-y">
    <SectionHeading eyebrow="Capabilities" title="Everything you need to test a real wallet.">
      walletwright rebuilds the approach that works: onboard once, cache the profile, drive the
      popups. Plain @playwright/test, current wallet and Chromium versions, no fork and no patched
      dependencies.
    </SectionHeading>

    <dl className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <div
          className="border-border bg-card shadow-card rounded-lg border p-6"
          key={feature.title}
        >
          <dt className="text-card-foreground font-medium">
            <feature.icon aria-hidden="true" className="size-6 shrink-0" />
            <span className="mt-4 block">{feature.title}</span>
          </dt>
          <dd className="text-muted-foreground mt-2 text-base text-pretty sm:text-sm">
            {feature.description}
          </dd>
        </div>
      ))}
    </dl>
  </Section>
);

export { Features };
