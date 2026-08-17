import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const GITHUB_URL = "https://github.com/pedroapfilho/walletwright";

/** Logo variants follow the next-themes dark class rather than the OS color scheme. */
export const baseOptions = (): BaseLayoutProps => ({
  githubUrl: GITHUB_URL,
  links: [
    {
      external: true,
      text: "npm",
      type: "button",
      url: "https://www.npmjs.com/package/@walletwright/core",
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
