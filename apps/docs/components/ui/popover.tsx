"use client";
import type { VariantProps } from "class-variance-authority";
/* oxlint-disable react-doctor/no-multi-comp -- the popover is one compound
   primitive in three parts; splitting trigger/content into separate files
   would be a worse abstraction than the standard single-file pattern. */
import type { ComponentPropsWithRef, ReactNode } from "react";
import { createContext, use, useId } from "react";

import { cn } from "../../lib/cn";

import { buttonVariants } from "./button";

const PopoverContext = createContext<string | null>(null);

const Popover = ({ children }: { children: ReactNode }) => {
  const rawId = useId();
  const popoverId = `fd-popover-${rawId.replaceAll(":", "")}`;
  return <PopoverContext value={popoverId}>{children}</PopoverContext>;
};

type PopoverTriggerProps = ComponentPropsWithRef<"button"> & VariantProps<typeof buttonVariants>;

const PopoverTrigger = ({
  children,
  className,
  color,
  ref,
  size,
  ...props
}: PopoverTriggerProps) => {
  const ctx = use(PopoverContext);
  if (ctx === null) {
    throw new Error("PopoverTrigger must be used inside Popover");
  }
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={cn(
        (color ?? size) && buttonVariants({ color, size }),
        "popover-anchor",
        className,
      )}
      popoverTarget={ctx}
    >
      {children}
    </button>
  );
};

type PopoverContentProps = ComponentPropsWithRef<"div">;

const PopoverContent = ({ children, className, ref, ...props }: PopoverContentProps) => {
  const ctx = use(PopoverContext);
  if (ctx === null) {
    throw new Error("PopoverContent must be used inside Popover");
  }
  return (
    <div
      ref={ref}
      {...props}
      className={cn(
        "m-0 [&:not(:popover-open)]:hidden",
        "bg-fd-popover/60 text-fd-popover-foreground max-w-popover-viewport z-50 min-w-60 overflow-y-auto rounded-xl border p-2 text-sm shadow-lg backdrop-blur-lg",
        "popover-position-anchor popover-position-area popover-position-flip mt-1",
        className,
      )}
      id={ctx}
      popover="auto"
    >
      {children}
    </div>
  );
};

export { Popover, PopoverContent, PopoverTrigger };
