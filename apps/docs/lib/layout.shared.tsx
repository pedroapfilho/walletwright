import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const GITHUB_URL = "https://github.com/pedroapfilho/walletwright";

/**
 * Layout options shared between the docs layout and any home layout.
 * The nav title renders the walletwright brand mark. The site theme is toggled
 * via next-themes' `.dark` class, not `prefers-color-scheme`, so the
 * light/dark variant must swap on the Tailwind `dark:` variant, a
 * <picture> media query would follow the OS and show the wrong mark
 * whenever the toggle disagrees with the OS.
 */
export const baseOptions = (): BaseLayoutProps => ({
  githubUrl: GITHUB_URL,
  links: [
    {
      external: true,
      text: "npm",
      type: "button",
      url: "https://www.npmjs.com/package/walletwright",
    },
  ],
  nav: {
    title: (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="walletwright"
          className="block h-5 w-auto dark:hidden"
          height={20}
          src="/walletwright-logo-light.svg"
          width={150}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="walletwright"
          className="hidden h-5 w-auto dark:block"
          height={20}
          src="/walletwright-logo-dark.svg"
          width={150}
        />
      </>
    ),
    transparentMode: "top",
  },
});
