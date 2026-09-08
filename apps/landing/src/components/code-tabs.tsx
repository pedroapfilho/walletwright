"use client";

import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

type Tab = {
  label: string;
  panel: ReactNode;
};

type CodeTabsProps = {
  className?: string;
  label: string;
  tabs: Array<Tab>;
};

/**
 * A WAI-ARIA tab strip over server-rendered panels. The panels arrive as
 * already-highlighted nodes, so switching costs no re-render of shiki.
 */
const CodeTabs = ({ className, label, tabs }: CodeTabsProps) => {
  const [active, setActive] = useState(0);
  const id = useId();

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    document.querySelector<HTMLButtonElement>(`[id="${id}-tab-${String(next)}"]`)?.focus();
  };

  const keyTargets = new Map<string, (index: number) => number>([
    ["ArrowLeft", (index) => index - 1],
    ["ArrowRight", (index) => index + 1],
    ["End", () => tabs.length - 1],
    ["Home", () => 0],
  ]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = keyTargets.get(event.key);
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    focusTab(target(index));
  };

  return (
    <div className={className}>
      <div aria-label={label} className="world-tablist" role="tablist">
        {tabs.map((tab, index) => (
          <button
            aria-controls={`${id}-panel-${String(index)}`}
            aria-selected={index === active}
            className="world-tab"
            id={`${id}-tab-${String(index)}`}
            key={tab.label}
            onClick={() => {
              setActive(index);
            }}
            onKeyDown={(event) => {
              handleKeyDown(event, index);
            }}
            role="tab"
            tabIndex={index === active ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          aria-labelledby={`${id}-tab-${String(index)}`}
          className="world-tabpanel"
          hidden={index !== active}
          id={`${id}-panel-${String(index)}`}
          key={tab.label}
          role="tabpanel"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
};

export { CodeTabs };
