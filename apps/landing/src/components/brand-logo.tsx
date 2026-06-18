import { cn } from "@/lib/cn";

type BrandLogoProps = {
  className?: string;
};

/**
 * The walletwright wordmark: the "approve" check mark plus the name. Everything
 * is `currentColor`, so it follows the page foreground (dark on light, light on
 * dark) without shipping separate light/dark assets.
 */
const BrandLogo = ({ className }: BrandLogoProps) => (
  <span className={cn("text-foreground inline-flex items-center gap-2", className)}>
    <svg
      aria-hidden="true"
      className="size-6 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        height="19"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="19"
        x="2.5"
        y="2.5"
      />
      <path
        d="M7 12.3l3.2 3.2 6-6.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
    <span className="text-[1.05rem] font-semibold tracking-tight">walletwright</span>
  </span>
);

export { BrandLogo };
