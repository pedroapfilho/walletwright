import { CopyButton } from "@/components/copy-button";
import { INSTALL_COMMAND } from "@/lib/site";

/**
 * Wraps rather than truncates on small screens. At 390px the command needs more
 * room than the column has, and truncating would hide `@playwright/test`, the
 * half people most often miss.
 */
const InstallCommand = () => (
  <div className="border-border bg-card text-card-foreground inline-flex max-w-full items-center gap-3 rounded-md border py-2 pr-2 pl-4 font-mono text-sm shadow-sm">
    <span aria-hidden="true" className="text-muted-foreground select-none">
      $
    </span>
    <code className="min-w-0 wrap-break-word sm:truncate">{INSTALL_COMMAND}</code>
    <CopyButton
      className="text-muted-foreground hover:text-foreground"
      label="Copy install command"
      value={INSTALL_COMMAND}
    />
  </div>
);

export { InstallCommand };
