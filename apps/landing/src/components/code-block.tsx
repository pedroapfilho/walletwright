import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { codeToHast } from "shiki";

type CodeBlockProps = {
  code: string;
  filename?: string;
  lang?: string;
};

/**
 * Server-rendered syntax highlighting via shiki. We convert shiki's HAST into
 * real React elements (instead of dangerouslySetInnerHTML) so the highlighted
 * markup is rendered as ordinary children. The panel is always dark: a
 * deliberate fixed surface that reads as intentional on the static page. With a
 * `filename`, it gets a window title bar so it reads as an editor.
 */
const CodeBlock = async ({ code, filename, lang = "tsx" }: CodeBlockProps) => {
  const hast = await codeToHast(code, { lang, theme: "github-dark-default" });

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#0d1117] font-mono text-sm shadow-lg [&_pre]:overflow-x-auto [&_pre]:p-5 [&_pre]:leading-relaxed">
      {filename ? (
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="size-3 rounded-full bg-white/15" />
          <span className="size-3 rounded-full bg-white/15" />
          <span className="size-3 rounded-full bg-white/15" />
          <span className="ml-2 text-white/50">{filename}</span>
        </div>
      ) : null}
      {toJsxRuntime(hast, { Fragment, jsx, jsxs })}
    </div>
  );
};

export { CodeBlock };
