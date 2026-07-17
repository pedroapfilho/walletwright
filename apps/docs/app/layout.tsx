import "@/app/global.css";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  description:
    "Documentation for walletwright: Playwright wallet automation for MetaMask (EVM + Solana), Phantom (EVM + Solana), and Slush (Sui). Connect and sign in real browser extensions.",
  metadataBase: new URL("https://walletwright.dev"),
  title: {
    default: "walletwright: Playwright wallet automation",
    template: "%s · walletwright docs",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { color: "oklch(1 0 0)", media: "(prefers-color-scheme: light)" },
    { color: "oklch(0.145 0 0)", media: "(prefers-color-scheme: dark)" },
  ],
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <body className="flex min-h-screen flex-col">
      {/* Scroll-driven reading progress bar, hidden under prefers-reduced-motion via CSS */}
      <div
        aria-hidden="true"
        className="reading-progress-bar fixed top-0 left-0 z-50 h-0.5 bg-[--primary] [animation-range:0%_100%]"
        style={{ width: "0%" }}
      />
      <RootProvider search={{ options: { type: "static" } }}>{children}</RootProvider>
    </body>
  </html>
);

export default RootLayout;
