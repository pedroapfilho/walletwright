import { svgText } from "@repo/social-image";
import { ImageResponse } from "next/og";

const alt = "walletwright: Playwright wallet automation";
const contentType = "image/png";
const size = { height: 630, width: 1200 };
const COLORS = { background: "#0a0a0a", ink: "#fafafa" };
const OpengraphImage = () =>
  new ImageResponse(
    <svg height={630} viewBox="0 0 1200 630" width={1200}>
      <rect fill={COLORS.background} height={630} width={1200} />
      <g fill="none" transform="translate(96 169) scale(4)">
        <rect
          height={19}
          rx={5.5}
          stroke={COLORS.ink}
          strokeWidth={1.8}
          width={19}
          x={2.5}
          y={2.5}
        />
        <path
          d="M7 12.3l3.2 3.2 6-6.4"
          stroke={COLORS.ink}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </g>
      {svgText("walletwright", { color: COLORS.ink, size: 84, tracking: -2.52, x: 216, y: 247 })}
      <g opacity={0.7}>
        {svgText(
          "Connect and sign real wallets in Playwright. MetaMask, Phantom, Rabby, Solflare, and Slush across EVM, Solana, and Sui.",
          { color: COLORS.ink, lineHeight: 1.3, size: 40, width: 900, x: 96, y: 350 },
        )}
      </g>
    </svg>,
    size,
  );
export { alt, contentType, size };
export default OpengraphImage;
