const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.walletwright.dev";
const GETTING_STARTED_URL = `${DOCS_URL}/getting-started`;
const GITHUB_URL = "https://github.com/pedroapfilho/walletwright";
const NPM_URL = "https://www.npmjs.com/package/@walletwright/core";
const DEMO_TESTS_URL = "https://github.com/pedroapfilho/walletwright/tree/main/apps/demo/tests";

const INSTALL_COMMAND = "npm i -D @walletwright/core @playwright/test";

export { DEMO_TESTS_URL, DOCS_URL, GETTING_STARTED_URL, GITHUB_URL, NPM_URL, INSTALL_COMMAND };
