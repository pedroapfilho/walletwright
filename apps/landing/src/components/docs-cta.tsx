import { ButtonLink } from "@/components/button-link";
import { GETTING_STARTED_URL, GITHUB_URL } from "@/lib/site";

const DocsCta = () => (
  <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
    <div className="border-border bg-card flex flex-col items-center rounded-2xl border px-6 py-14 text-center sm:py-20">
      <h2 className="mx-auto max-w-[20ch] text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        Ready to test your dapp?
      </h2>
      <p className="text-muted-foreground mx-auto mt-5 max-w-[52ch] text-lg text-pretty">
        Install, describe a wallet, build the cache, and write a connect-and-sign test. It’s all in
        the getting-started guide.
      </p>
      <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
        <ButtonLink href={GETTING_STARTED_URL} variant="primary">
          Read the docs
        </ButtonLink>
        <ButtonLink href={GITHUB_URL} rel="noopener noreferrer" target="_blank" variant="secondary">
          View on GitHub
        </ButtonLink>
      </div>
    </div>
  </section>
);

export { DocsCta };
