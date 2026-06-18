import "@fontsource-variable/geist/index.css";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const DESCRIPTION =
  "walletwright drives real MetaMask and Phantom extensions in Playwright: onboard from a seed, cache the profile, then unlock and click through connect and signature popups. EVM and Solana, no mocks.";
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
    "Synpress alternative",
    "dapp testing",
    "EVM testing",
    "Solana testing",
    "browser extension testing",
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

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export { metadata };
export default RootLayout;
