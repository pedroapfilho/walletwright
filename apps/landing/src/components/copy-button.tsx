"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

type CopyButtonProps = {
  className?: string;
  label: string;
  value: string;
};

const RESET_DELAY_MS = 2000;

const ICON_PROPS = {
  "aria-hidden": true,
  className: "size-4",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

const CopyButton = ({ className, label, value }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      // Without clearing, a second click inside the window lets the first
      // timer fire and blank the checkmark while the new copy is still fresh.
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), RESET_DELAY_MS);
    } catch {
      // Clipboard unavailable (insecure context or denied permission); do nothing.
    }
  };

  return (
    <>
      <button
        aria-label={label}
        className={cn(
          "focus-visible:outline-ring relative inline-flex size-7 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
          className,
        )}
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <svg {...ICON_PROPS}>
            <path d="m5 13 4 4L19 7" />
          </svg>
        ) : (
          <svg {...ICON_PROPS}>
            <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-1/2 pointer-fine:hidden"
        />
      </button>
      {/*
        A swapped icon plus a mutated aria-label is not reliably announced on the
        focused element, so success needs its own live region.
      */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
};

export { CopyButton };
