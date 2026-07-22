import {
  NetworkEthereum,
  NetworkSolana,
  NetworkSui,
  WalletMetamask,
  WalletPhantom,
  WalletRabby,
} from "@web3icons/react";
import type { ReactNode } from "react";

type Target = {
  capability: string;
  chain: { icon: ReactNode; name: string };
  wallet: { icon: ReactNode; name: string };
};

const TARGETS: Array<Target> = [
  {
    capability: "Connect, personal_sign, typed-data, and transactions.",
    chain: { icon: <NetworkEthereum aria-hidden size={18} variant="branded" />, name: "EVM" },
    wallet: { icon: <WalletMetamask aria-hidden size={32} variant="branded" />, name: "MetaMask" },
  },
  {
    capability: "Connect and sign through the Solana Wallet Standard.",
    chain: { icon: <NetworkSolana aria-hidden size={18} variant="branded" />, name: "Solana" },
    wallet: { icon: <WalletMetamask aria-hidden size={32} variant="branded" />, name: "MetaMask" },
  },
  {
    capability: "Connect and sign on window.phantom.ethereum.",
    chain: { icon: <NetworkEthereum aria-hidden size={18} variant="branded" />, name: "EVM" },
    wallet: { icon: <WalletPhantom aria-hidden size={32} variant="branded" />, name: "Phantom" },
  },
  {
    capability: "Connect and sign on window.phantom.solana.",
    chain: { icon: <NetworkSolana aria-hidden size={18} variant="branded" />, name: "Solana" },
    wallet: { icon: <WalletPhantom aria-hidden size={32} variant="branded" />, name: "Phantom" },
  },
  {
    capability: "Connect and personal_sign on window.ethereum.",
    chain: { icon: <NetworkEthereum aria-hidden size={18} variant="branded" />, name: "EVM" },
    wallet: { icon: <WalletRabby aria-hidden size={32} variant="branded" />, name: "Rabby" },
  },
  {
    capability: "Connect and sign through the Solana Wallet Standard.",
    chain: { icon: <NetworkSolana aria-hidden size={18} variant="branded" />, name: "Solana" },
    // @web3icons/react has no Solflare brand mark, so reuse the Solana network icon.
    wallet: { icon: <NetworkSolana aria-hidden size={32} variant="branded" />, name: "Solflare" },
  },
  {
    capability: "Connect and sign through the Sui Wallet Standard.",
    chain: { icon: <NetworkSui aria-hidden size={18} variant="branded" />, name: "Sui" },
    // @web3icons/react has no Slush brand mark, so reuse the Sui network icon as the wallet icon.
    wallet: { icon: <NetworkSui aria-hidden size={32} variant="branded" />, name: "Slush" },
  },
];

const Wallets = () => (
  <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
    <div>
      <h2 className="max-w-[24ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Real wallets across EVM, Solana, and Sui.
      </h2>
      <p className="text-muted-foreground mt-4 max-w-[56ch] text-lg text-pretty">
        The same{" "}
        <code className="bg-muted rounded-sm px-1.5 py-0.5 font-mono text-[0.9em]">wallet</code>{" "}
        fixture drives MetaMask, Phantom, Rabby, and Slush, so your tests use one API and never
        branch per chain.
      </p>
    </div>

    <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      {TARGETS.map((target) => (
        <li
          className="border-border bg-card rounded-lg border p-6"
          key={`${target.wallet.name}-${target.chain.name}`}
        >
          <div className="flex items-center gap-3">
            <span className="shrink-0">{target.wallet.icon}</span>
            <span className="text-card-foreground font-medium">{target.wallet.name}</span>
          </div>
          <div className="text-muted-foreground mt-4 flex items-center gap-2">
            <span className="shrink-0">{target.chain.icon}</span>
            <span className="text-foreground/80 text-sm font-medium">{target.chain.name}</span>
          </div>
          <p className="text-muted-foreground mt-2 text-sm text-pretty">{target.capability}</p>
        </li>
      ))}
    </ul>
  </section>
);

export { Wallets };
