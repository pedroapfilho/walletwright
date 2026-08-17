import type { ReactNode } from "react";

import { Eyebrow } from "@/components/eyebrow";

type SectionHeadingProps = {
  children?: ReactNode;
  eyebrow: string;
  title: string;
};

const SectionHeading = ({ children, eyebrow, title }: SectionHeadingProps) => (
  <div>
    <Eyebrow>{eyebrow}</Eyebrow>
    <h2 className="mt-4 max-w-[35ch] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
      {title}
    </h2>
    {children === undefined || children === null ? null : (
      <p className="text-muted-foreground mt-4 max-w-[48ch] text-lg text-pretty">{children}</p>
    )}
  </div>
);

export { SectionHeading };
