import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

const DESCRIPTION =
  "walletwright drives real MetaMask, Phantom, Rabby, Solflare, and Slush extensions in Playwright tests. Connect and sign on EVM, Solana, and Sui, with no mocks.";
const TITLE = "walletwright: Playwright wallet automation";

const metadata: Metadata = {
  alternates: { canonical: "/" },
  applicationName: "walletwright",
  authors: [{ name: "Pedro Filho", url: "https://github.com/pedroapfilho" }],
  category: "technology",
  creator: "Pedro Filho",
  description: DESCRIPTION,
  keywords: [
    "Playwright wallet testing",
    "MetaMask Playwright",
    "Phantom Playwright",
    "wallet automation",
    "e2e web3 testing",
    "dapp testing",
    "EVM testing",
    "Solana testing",
    "browser extension testing",
    "Rabby Playwright",
    "Solflare Playwright",
    "Slush Playwright",
    "Sui testing",
    "Synpress alternative",
    "walletwright",
  ],
  metadataBase: new URL("https://walletwright.dev"),
  openGraph: {
    description: DESCRIPTION,
    locale: "en_US",
    siteName: "walletwright",
    title: TITLE,
    type: "website",
    url: "/",
  },
  title: {
    default: TITLE,
    template: "%s · walletwright",
  },
  twitter: {
    card: "summary_large_image",
    description: DESCRIPTION,
    title: TITLE,
  },
};

const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#1c1d21",
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html className="antialiased" lang="en">
    <body>
      {/* oxlint-disable-next-line react-doctor/no-layout-shifting-interaction-state -- the padding
      lands only alongside focus:fixed, which takes the link out of flow, so no sibling can move */}
      <a
        className="focus:border-border focus:bg-background focus-visible:outline-ring sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-60 focus:rounded-md focus:border focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus-visible:outline-2"
        // oxlint-disable-next-line react-doctor/anchor-target-exists -- the id is set on <main> in app/page.tsx, which the rule does not reach from this file
        href="#main-content"
      >
        Skip to content
      </a>
      {children}
    </body>
  </html>
);

export { metadata, viewport };
export default RootLayout;
