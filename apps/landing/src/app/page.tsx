import "./page.css";

import {
  WalletMetamask,
  WalletPhantom,
  WalletRabby,
  WalletSolflare,
  NetworkSui,
} from "@web3icons/react";
import type { ReactNode } from "react";

import { CodeBlock } from "@/components/code-block";
import { CodeTabs } from "@/components/code-tabs";
import {
  FEATURES,
  HERO_CODE,
  RUN_CAPTION,
  RUN_OUTPUT,
  SETUP_CODE,
  VERIFIED_PAIRS,
} from "@/lib/content";
import { DEMO_TESTS_URL, DOCS_URL, GETTING_STARTED_URL, GITHUB_URL, NPM_URL } from "@/lib/site";

const CONTRACT = `
THESIS: the landing page is the first page of the docs, the way viem and
wagmi open: wordmark, one sentence, install tabs, fact badges, then the API
itself as content. Nothing is sold that is not a function you can call.
OWN-WORLD: charcoal ground, Geist, pass-check green as the only accent,
hairline cards, the API surface set as a reference list.
STORY: the visitor installs before scrolling, reads the six calls that make
up the library, and moves to the docs already knowing the shape.
FIRST VIEWPORT: wordmark and one-line description left with three buttons;
npm/pnpm/bun install tabs right; a badge row (npm, MIT, wallets, chains).
FORM: grounded conventional candidate (docs-native landing, cf. viem and
wagmi); safer-register round 1; seed 935f3678.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
`;

type ApiEntry = { description: string; name: string };

/** The public surface as documented in AGENTS.md; nothing here is speculative. */
const API: Array<ApiEntry> = [
  {
    description: "Returns a @playwright/test `test` with a `wallet` fixture for the given setup.",
    name: "createWalletFixtures(setup)",
  },
  {
    description: "Finds the wallet's approval popup and confirms the connection request.",
    name: "wallet.connectToDapp()",
  },
  {
    description:
      "Finds the signature popup and confirms it, re-authenticating where the wallet asks.",
    name: "wallet.confirmSignature()",
  },
  {
    description: "Rejects the pending request, on wallets that declare it.",
    name: "wallet.reject()",
  },
  {
    description:
      "Onboards the extension from the seed once and writes the profile to the cache dir.",
    name: "buildCache(setup)",
  },
  {
    description: "CLI form of buildCache, for the wallets listed in wallet-setup.ts.",
    name: "walletwright cache",
  },
];

type Wallet = { chains: string; icon: ReactNode; name: string; spec: string };

const WALLET_ICONS = [
  { icon: <WalletMetamask aria-hidden size={22} variant="branded" />, name: "MetaMask" },
  { icon: <WalletPhantom aria-hidden size={22} variant="branded" />, name: "Phantom" },
  { icon: <WalletRabby aria-hidden size={22} variant="branded" />, name: "Rabby" },
  { icon: <WalletSolflare aria-hidden size={22} variant="branded" />, name: "Solflare" },
  { icon: <NetworkSui aria-hidden size={22} variant="branded" />, name: "Slush" },
];

const WALLETS: Array<Wallet> = WALLET_ICONS.map(({ icon, name }) => {
  const pairs = VERIFIED_PAIRS.filter((pair) => pair.wallet === name);
  return {
    chains: pairs.map((pair) => pair.ecosystem).join(" · "),
    icon,
    name,
    spec: [...new Set(pairs.map((pair) => pair.spec))].join(", "),
  };
});

const INSTALLS = [
  { command: "npm i -D @walletwright/core @playwright/test", label: "npm" },
  { command: "pnpm add -D @walletwright/core @playwright/test", label: "pnpm" },
  { command: "bun add -d @walletwright/core @playwright/test", label: "bun" },
];

const Mark = () => (
  <svg aria-hidden="true" className="ref-mark" fill="none" viewBox="0 0 24 24">
    <rect height="19" rx="5.5" stroke="currentColor" strokeWidth="1.8" width="19" x="2.5" y="2.5" />
    <path
      d="M7 12.3l3.2 3.2 6-6.4"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

const LandingPage = () => (
  <div className="ref">
    {/* oxlint-disable-next-line react/no-danger -- emits the impeccable direction contract as an HTML comment that survives the production build */}
    <div dangerouslySetInnerHTML={{ __html: `<!--${CONTRACT}-->` }} hidden />

    <header className="ref-nav">
      <div className="ref-measure ref-nav-row">
        <p className="ref-brand">
          <Mark />
        </p>
        <nav aria-label="Site" className="ref-nav-links">
          <a href={DOCS_URL}>Docs</a>
          <a href={`${DOCS_URL}/wallets`}>Wallets</a>
          <a href={DEMO_TESTS_URL} rel="noopener noreferrer" target="_blank">
            Examples
          </a>
          <a href={GITHUB_URL} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </nav>
      </div>
    </header>

    <main className="ref-measure" id="main-content" tabIndex={-1}>
      <section aria-label="Introduction" className="ref-hero">
        <div>
          <h1 className="ref-wordmark">walletwright</h1>
          <p className="ref-lede">
            Connect and sign with <strong>real</strong>, <strong>cached</strong>, and{" "}
            <strong>current</strong> wallet extensions in Playwright, across EVM, Solana, and Sui.
          </p>
          <div className="ref-actions">
            <a className="ref-btn ref-btn-primary" href={GETTING_STARTED_URL}>
              Get started
            </a>
            <a className="ref-btn ref-btn-ghost" href={`${DOCS_URL}/why`}>
              Why walletwright?
            </a>
            <a
              className="ref-btn ref-btn-ghost"
              href={GITHUB_URL}
              rel="noopener noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </div>
        </div>

        <div>
          <CodeTabs
            className="ref-install"
            label="Package manager"
            tabs={INSTALLS.map((install) => ({
              label: install.label,
              panel: (
                <CodeBlock
                  className="ref-install-code"
                  code={install.command}
                  label={`Install with ${install.label}`}
                  lang="bash"
                  wrap
                />
              ),
            }))}
          />
          <ul className="ref-badges" role="list">
            <li>
              <span>npm</span>
              <a href={NPM_URL}>@walletwright/core</a>
            </li>
            <li>
              <span>license</span>
              <strong>MIT</strong>
            </li>
            <li>
              <span>wallets</span>
              <strong>5</strong>
            </li>
            <li>
              <span>chains</span>
              <strong>3</strong>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="ref-features-title" className="ref-section">
        <h2 className="ref-visually-hidden" id="ref-features-title">
          Features
        </h2>
        <ul className="ref-cards" role="list">
          {FEATURES.map((feature) => (
            <li className="ref-card" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ref-api-title" className="ref-section ref-two-col">
        <div>
          <h2 id="ref-api-title">The whole API</h2>
          <p className="ref-body">
            Six calls. Each wallet declares which optional actions it has driven end-to-end; the
            rest throw a clear error instead of pretending.
          </p>
          <dl className="ref-api">
            {API.map((entry) => (
              <div className="ref-api-row" key={entry.name}>
                <dt>
                  <code>{entry.name}</code>
                </dt>
                <dd>{entry.description}</dd>
              </div>
            ))}
          </dl>
        </div>
        <CodeBlock className="ref-code" code={HERO_CODE} filename="connect.spec.ts" />
      </section>

      <section aria-labelledby="ref-wallets-title" className="ref-section ref-two-col">
        <div>
          <h2 id="ref-wallets-title">Verified wallets</h2>
          <p className="ref-body">
            A wallet enters the registry once its connect and sign specs pass against the demo dapp.
            Coinbase Wallet, Trust, Backpack, Glow, Suiet, and Nightly are on the roadmap, not the
            list.
          </p>
          <ul className="ref-wallets" role="list">
            {WALLETS.map((wallet) => (
              <li key={wallet.name}>
                {wallet.icon}
                <span className="ref-wallet-name">{wallet.name}</span>
                <span className="ref-wallet-chains">{wallet.chains}</span>
                <span className="ref-wallet-spec">{wallet.spec}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <CodeBlock
            className="ref-code"
            code={RUN_OUTPUT}
            label="Test run output"
            lang="ansi"
            wrap
          />
          <p className="ref-caption">{RUN_CAPTION}</p>
        </div>
      </section>

      <section aria-labelledby="ref-setup-title" className="ref-section ref-two-col">
        <div>
          <h2 id="ref-setup-title">Setup</h2>
          <p className="ref-body">
            Describe each wallet once. <code>walletwright cache</code> onboards it into a profile on
            disk; every test launches from a copy and only unlocks.
          </p>
          <a className="ref-link" href={GETTING_STARTED_URL}>
            Getting started →
          </a>
        </div>
        <CodeBlock className="ref-code" code={SETUP_CODE} filename="wallet-setup.ts" wrap />
      </section>
    </main>

    <footer className="ref-footer">
      <div className="ref-measure ref-footer-row">
        <p>Released under the MIT License.</p>
        <nav aria-label="Footer" className="ref-nav-links">
          <a href={DOCS_URL}>Docs</a>
          <a href={GITHUB_URL} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
          <a href={NPM_URL}>npm</a>
        </nav>
      </div>
    </footer>
  </div>
);

export default LandingPage;
