const apps = {
  demo: { name: "walletwright.demo", port: 3000 },
  docs: { name: "walletwright.docs", port: 4000 },
  landing: { name: "walletwright.landing", port: 4100 },
} as const;

const urlEnv = {
  NEXT_PUBLIC_DOCS_URL: ["docs"],
} as const satisfies Record<string, ReadonlyArray<keyof typeof apps>>;

export { apps, urlEnv };
