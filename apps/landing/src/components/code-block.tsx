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

/** Server-render Shiki as React elements and retain keyboard focus for the scroll region. */
const CodeBlock = async ({ code, filename, label, lang = "tsx", wrap = false }: CodeBlockProps) => {
  const hast = await codeToHast(code, { lang, theme: "github-dark-default" });

  return (
    <section
      aria-label={label ?? filename ?? "Code example"}
      className={cn(
        "overflow-hidden rounded-lg border border-white/10 bg-[#0d1117] font-mono text-sm shadow-lg",
        "[&_pre]:overflow-x-auto [&_pre]:p-5 [&_pre]:leading-relaxed",
        "[&_pre:focus-visible]:outline-2 [&_pre:focus-visible]:-outline-offset-2 [&_pre:focus-visible]:outline-white/40",
        wrap && "[&_pre]:wrap-break-word [&_pre]:whitespace-pre-wrap",
      )}
    >
      {filename !== undefined && filename !== "" ? (
        <div className="flex items-center gap-2 border-b border-white/10 py-2 pr-2 pl-4">
          <span className="grow truncate text-white/50">{filename}</span>
          <CopyButton
            className="text-white/50 hover:text-white"
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
