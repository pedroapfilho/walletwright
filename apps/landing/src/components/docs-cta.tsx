import { ButtonLink } from "@/components/button-link";
import { DEMO_TESTS_URL, DOCS_URL } from "@/lib/site";

const DocsCta = () => (
  <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
    <div className="border-border bg-card shadow-card flex flex-col items-center rounded-xl border px-6 py-12 text-center sm:py-16">
      <h2 className="mx-auto max-w-[20ch] text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        Write your first connect-and-sign test.
      </h2>
      <p className="text-muted-foreground mx-auto mt-5 max-w-[52ch] text-lg text-pretty">
        The getting-started guide covers install, wallet setup, the cache build, and the first spec.
      </p>
      <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
        <ButtonLink href={DOCS_URL} variant="primary">
          Read the docs
        </ButtonLink>
        <ButtonLink
          href={DEMO_TESTS_URL}
          rel="noopener noreferrer"
          target="_blank"
          variant="secondary"
        >
          Browse the demo specs
        </ButtonLink>
      </div>
    </div>
  </section>
);

export { DocsCta };
