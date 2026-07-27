import { ImageResponse } from "next/og";

const alt = "walletwright: Playwright wallet automation";
const contentType = "image/png";
const size = { height: 630, width: 1200 };

// Matches the dark `--background` and `icon.svg` so the card reads as the same surface as the site.
const INK = "#0a0a0a";
const PAPER = "#fafafa";

/**
 * Rendered by satori, which cannot parse the variable woff2 that
 * `@fontsource-variable/geist` ships, so this falls back to next/og's bundled
 * face rather than the site's own type.
 */
const OpengraphImage = () =>
  new ImageResponse(
    <div
      style={{
        background: INK,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        padding: "96px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: "24px" }}>
        <svg fill="none" height="96" viewBox="0 0 24 24" width="96">
          <rect height="19" rx="5.5" stroke={PAPER} strokeWidth="1.8" width="19" x="2.5" y="2.5" />
          <path
            d="M7 12.3l3.2 3.2 6-6.4"
            stroke={PAPER}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        <span style={{ color: PAPER, fontSize: 84, letterSpacing: "-0.03em" }}>walletwright</span>
      </div>
      <div
        style={{
          color: "rgba(250,250,250,0.7)",
          display: "flex",
          fontSize: 40,
          lineHeight: 1.3,
          marginTop: "40px",
          maxWidth: "900px",
        }}
      >
        Connect and sign real wallets in Playwright. MetaMask, Phantom, Rabby, Solflare, and Slush
        across EVM, Solana, and Sui.
      </div>
    </div>,
    size,
  );

export { alt, contentType, size };
export default OpengraphImage;
