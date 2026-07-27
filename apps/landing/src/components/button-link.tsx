import type { AnchorHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  size?: "md" | "sm";
  variant?: "primary" | "secondary";
};

const BASE_CLASSES =
  "relative inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,box-shadow,color,translate] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

const VARIANT_CLASSES: Record<NonNullable<ButtonLinkProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground ring-1 ring-inset ring-black/5 hover:bg-primary-hover active:translate-y-px dark:ring-white/10",
  secondary:
    "border border-border bg-background text-foreground hover:bg-muted hover:border-foreground/20 active:translate-y-px",
};

const SIZE_CLASSES: Record<NonNullable<ButtonLinkProps["size"]>, string> = {
  md: "px-4 py-2.5 text-sm",
  sm: "px-3 py-1.5 text-sm",
};

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
    {/* `sm` renders ~33px tall, under the 44px touch minimum, so coarse pointers get a padded hit area. */}
    <span
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-1/2 pointer-fine:hidden"
    />
  </a>
);

export { ButtonLink };
