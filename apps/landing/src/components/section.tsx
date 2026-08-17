import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionProps = {
  children: ReactNode;
  className?: string;
};

const Section = ({ children, className }: SectionProps) => (
  <section className={cn("py-16 sm:py-24", className)}>
    <div className="mx-auto w-full max-w-6xl px-6">{children}</div>
  </section>
);

export { Section };
