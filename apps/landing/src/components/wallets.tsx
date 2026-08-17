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

import { Section } from "@/components/section";
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
    icon: <WalletMetamask aria-hidden size={32} variant="branded" />,
    name: "MetaMask",
  },
  {
    ecosystems: [EVM, SOLANA],
    icon: <WalletPhantom aria-hidden size={32} variant="branded" />,
    name: "Phantom",
  },
  {
    ecosystems: [EVM],
    icon: <WalletRabby aria-hidden size={32} variant="branded" />,
    name: "Rabby",
  },
  {
    ecosystems: [SOLANA],
    icon: <WalletSolflare aria-hidden size={32} variant="branded" />,
    name: "Solflare",
  },
  {
    ecosystems: [SUI],
    icon: <NetworkSui aria-hidden size={32} variant="branded" />,
    name: "Slush",
  },
];

const Wallets = () => (
  <Section>
    <SectionHeading eyebrow="Coverage" title="Real wallets across EVM, Solana, and Sui.">
      One <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono">wallet</code> fixture drives
      all five. It connects and signs on{" "}
      <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono">window.ethereum</code>, the
      Solana Wallet Standard, and the Sui Wallet Standard, so your tests never branch per chain.
    </SectionHeading>

    {/* The gap doubles as the divider: the parent's border color shows through between cells,
    so the rules reflow with the column count instead of needing per-breakpoint nth-child math. */}
    <ul
      className="border-border bg-border mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-xl border md:grid-cols-5"
      role="list"
    >
      {WALLETS.map((wallet) => (
        <li className="bg-background flex items-center gap-4 p-5 md:block" key={wallet.name}>
          <span className="flex shrink-0">{wallet.icon}</span>
          <div className="min-w-0 md:mt-4">
            <p className="font-medium">{wallet.name}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5" role="list">
              {wallet.ecosystems.map((ecosystem) => (
                <li
                  className="text-muted-foreground border-border inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-1 font-mono text-sm sm:text-xs"
                  key={ecosystem.name}
                >
                  {ecosystem.icon}
                  {ecosystem.name}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  </Section>
);

export { Wallets };
