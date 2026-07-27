import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  children?: ReactNode;
  eyebrow: string;
  title: string;
  titleClassName?: string;
};

const SectionHeading = ({ children, eyebrow, title, titleClassName }: SectionHeadingProps) => (
  <div>
    <p className="text-brand font-mono text-xs tracking-[0.14em] uppercase">{eyebrow}</p>
    <h2
      className={cn(
        "mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
        titleClassName,
      )}
    >
      {title}
    </h2>
    {children ? (
      <p className="text-muted-foreground mt-4 max-w-[60ch] text-lg text-pretty">{children}</p>
    ) : null}
  </div>
);

export { SectionHeading };
