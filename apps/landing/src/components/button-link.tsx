import type { AnchorHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  size?: "md" | "sm";
  variant?: "primary" | "secondary" | "soft";
};

const BASE_CLASSES =
  "relative inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const VARIANT_CLASSES = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:translate-y-px",
  secondary: "border border-border text-foreground hover:bg-muted active:translate-y-px",
  soft: "bg-primary/10 text-primary hover:bg-primary/15 active:translate-y-px",
} satisfies Record<NonNullable<ButtonLinkProps["variant"]>, string>;

const SIZE_CLASSES = {
  md: "px-3 py-2 text-base sm:text-sm",
  sm: "px-3 py-1.5 text-sm",
} satisfies Record<NonNullable<ButtonLinkProps["size"]>, string>;

const ButtonLink = ({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonLinkProps) => (
  <a
    className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
    {...props}
  >
    {children}
    {/* Both sizes render under the 48px touch minimum, so coarse pointers get a padded hit area. */}
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
    />
  </a>
);

export { ButtonLink };
