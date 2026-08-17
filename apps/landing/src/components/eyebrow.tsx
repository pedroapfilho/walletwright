import type { ReactNode } from "react";

type EyebrowProps = {
  children: ReactNode;
};

const Eyebrow = ({ children }: EyebrowProps) => (
  <p className="text-muted-foreground font-mono text-sm tracking-wide uppercase">{children}</p>
);

export { Eyebrow };
