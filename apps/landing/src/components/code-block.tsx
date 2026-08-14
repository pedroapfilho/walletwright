import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { codeToHast } from "shiki";

import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/cn";

type CodeBlockProps = {
  code: string;
  filename?: string;
  label?: string;
  lang?: string;
  wrap?: boolean;
};

/**
 * Shiki exposes dual-theme variables for server-rendered color-mode parity.
 * Its focusable `<pre>` needs a named wrapper and a visible custom focus ring.
 */
const CodeBlock = async ({ code, filename, label, lang = "tsx", wrap = false }: CodeBlockProps) => {
  const hast = await codeToHast(code, {
    defaultColor: false,
    lang,
    themes: { dark: "github-dark-default", light: "github-light-default" },
  });

  return (
    <section
      aria-label={label ?? filename ?? "Code example"}
      className={cn(
        "border-border bg-card text-card-foreground overflow-hidden rounded-lg border font-mono text-sm shadow-lg",
        "[&_pre]:overflow-x-auto [&_pre]:p-5 [&_pre]:leading-relaxed",
        "[&_pre:focus-visible]:outline-ring [&_pre:focus-visible]:outline-2 [&_pre:focus-visible]:-outline-offset-2",
        wrap && "[&_pre]:wrap-break-word [&_pre]:whitespace-pre-wrap",
      )}
    >
      {filename !== undefined && filename !== "" ? (
        <div className="border-border flex items-center gap-2 border-b py-2 pr-2 pl-4">
          <span className="text-muted-foreground grow truncate">{filename}</span>
          <CopyButton
            className="text-muted-foreground hover:text-foreground"
            label={`Copy ${filename}`}
            value={code}
          />
        </div>
      ) : null}
      {toJsxRuntime(hast, { Fragment, jsx, jsxs })}
    </section>
  );
};

export { CodeBlock };
