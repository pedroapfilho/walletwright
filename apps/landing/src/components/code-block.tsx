import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { codeToHast } from "shiki";

import { CopyButton } from "@/components/copy-button";

type CodeBlockProps = {
  className?: string;
  code: string;
  copyLabel?: string;
  filename?: string;
  label?: string;
  lang?: string;
  wrap?: boolean;
};

/**
 * Shiki highlighting without the incumbent card chrome, so each variant's
 * stylesheet owns the frame. A world that is fixed light or dark pins one
 * shiki theme in its own CSS.
 */
const CodeBlock = async ({
  className,
  code,
  copyLabel,
  filename,
  label,
  lang = "tsx",
  wrap = false,
}: CodeBlockProps) => {
  const hast = await codeToHast(code, {
    defaultColor: false,
    lang,
    themes: { dark: "github-dark-default", light: "github-light-default" },
  });

  return (
    <figure aria-label={label ?? filename ?? "Code example"} className={className}>
      {filename !== undefined && filename !== "" ? (
        <figcaption className="world-code-head">
          <span className="world-code-filename">{filename}</span>
          <CopyButton label={copyLabel ?? `Copy ${filename}`} value={code} />
        </figcaption>
      ) : null}
      <div className={wrap ? "world-code-body world-code-wrap" : "world-code-body"}>
        {toJsxRuntime(hast, { Fragment, jsx, jsxs })}
      </div>
    </figure>
  );
};

export { CodeBlock };
