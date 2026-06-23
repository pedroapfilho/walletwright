import type { ReactNode } from "react";

type Feature = {
  description: string;
  icon: ReactNode;
  title: string;
};

const ICON_PROPS = {
  "aria-hidden": true,
  className: "size-5",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 1.75,
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

const FEATURES: Array<Feature> = [
  {
    description:
      "The actual MetaMask, Phantom, and Slush builds, loaded unpacked into Chromium, with no mocked providers.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="M16 12h.01" />
        <path d="M3 9h18" />
      </svg>
    ),
    title: "Real extensions",
  },
  {
    description:
      "buildCache imports the seed into a profile on disk once. Tests launch from a copy and only unlock, so every run starts in seconds.",
    icon: (
      <svg {...ICON_PROPS}>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14a9 3 0 0 0 18 0V5" />
        <path d="M3 12a9 3 0 0 0 18 0" />
      </svg>
    ),
    title: "Onboard once, cache it",
  },
  {
    description:
      "connectToDapp() and confirmSignature() drive MetaMask, Phantom (EVM and Solana), and Slush (Sui) the same way.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </svg>
    ),
    title: "EVM, Solana, and Sui, one API",
  },
  {
    description:
      "createWalletFixtures returns a @playwright/test test with a wallet fixture. No framework lock-in, you control the Playwright version.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M20 7 9 18l-5-5" />
      </svg>
    ),
    title: "Plain Playwright fixtures",
  },
  {
    description:
      "Approval popups open headed, so run under xvfb on CI. Cache building can run headless, and a couple of retries keeps runs stable.",
    icon: (
      <svg {...ICON_PROPS}>
        <rect height="14" rx="2" width="20" x="2" y="3" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    ),
    title: "CI-ready, headed",
  },
  {
    description:
      "Built on current wallet and Chromium versions, with no fork and no dependency overrides to maintain.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: "Current versions, no fork",
  },
];

const Features = () => (
  <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
    <div>
      <h2 className="max-w-[24ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Everything you need to test a real wallet.
      </h2>
      <p className="text-muted-foreground mt-4 max-w-[60ch] text-lg text-pretty">
        walletwright handles extension download, onboarding, caching, and popup approval, the parts
        that make wallet E2E flaky, so your tests stay focused on your dapp.
      </p>
    </div>

    <dl className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature) => (
        <div className="border-border bg-card rounded-lg border p-6" key={feature.title}>
          <div className="bg-foreground/[0.06] text-foreground flex size-10 items-center justify-center rounded-md">
            {feature.icon}
          </div>
          <dt className="text-card-foreground mt-4 font-medium">{feature.title}</dt>
          <dd className="text-muted-foreground mt-2 text-sm text-pretty">{feature.description}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export { Features };
