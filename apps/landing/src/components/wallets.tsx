import {
  NetworkEthereum,
  NetworkSolana,
  NetworkSui,
  WalletMetamask,
  WalletPhantom,
  WalletRabby,
  WalletSolflare,
} from "@web3icons/react";
import type { ReactNode } from "react";

import { SectionHeading } from "@/components/section-heading";

type Ecosystem = {
  icon: ReactNode;
  name: string;
};

type Wallet = {
  ecosystems: Array<Ecosystem>;
  icon: ReactNode;
  name: string;
};

const EVM: Ecosystem = {
  icon: <NetworkEthereum aria-hidden size={14} variant="branded" />,
  name: "EVM",
};
const SOLANA: Ecosystem = {
  icon: <NetworkSolana aria-hidden size={14} variant="branded" />,
  name: "Solana",
};
const SUI: Ecosystem = {
  icon: <NetworkSui aria-hidden size={14} variant="branded" />,
  name: "Sui",
};

const WALLETS: Array<Wallet> = [
  {
    ecosystems: [EVM, SOLANA],
    icon: <WalletMetamask aria-hidden size={28} variant="branded" />,
    name: "MetaMask",
  },
  {
    ecosystems: [EVM, SOLANA],
    icon: <WalletPhantom aria-hidden size={28} variant="branded" />,
    name: "Phantom",
  },
  {
    ecosystems: [EVM],
    icon: <WalletRabby aria-hidden size={28} variant="branded" />,
    name: "Rabby",
  },
  {
    ecosystems: [SOLANA],
    icon: <WalletSolflare aria-hidden size={28} variant="branded" />,
    name: "Solflare",
  },
  {
    ecosystems: [SUI],
    // @web3icons/react has no Slush brand mark, so reuse the Sui network icon.
    icon: <NetworkSui aria-hidden size={28} variant="branded" />,
    name: "Slush",
  },
];

const CARD_CLASSES =
  "border-border bg-card shadow-card hover:shadow-card-hover hover:border-foreground/20 rounded-lg border p-5 transition-[box-shadow,border-color,translate] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:last:col-span-2 lg:last:col-span-1";

const Wallets = () => (
  <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
    <SectionHeading eyebrow="Coverage" title="Real wallets across EVM, Solana, and Sui.">
      One <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-[0.9em]">wallet</code>{" "}
      fixture drives all five. It connects and signs on{" "}
      <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-[0.9em]">
        window.ethereum
      </code>
      , the Solana Wallet Standard, and the Sui Wallet Standard, so your tests never branch per
      chain.
    </SectionHeading>

    <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      {WALLETS.map((wallet) => (
        <li className={CARD_CLASSES} key={wallet.name}>
          <span className="block">{wallet.icon}</span>
          <p className="text-card-foreground mt-3 font-medium">{wallet.name}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {wallet.ecosystems.map((ecosystem) => (
              <li
                className="text-brand ring-brand/20 bg-brand/10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-xs ring-1 ring-inset"
                key={ecosystem.name}
              >
                {ecosystem.icon}
                {ecosystem.name}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  </section>
);

export { Wallets };
