import { ButtonLink } from "@/components/button-link";
import { Section } from "@/components/section";
import { DEMO_TESTS_URL, DOCS_URL } from "@/lib/site";

const DocsCta = () => (
  <Section>
    <div className="border-border bg-muted/60 flex flex-col items-center rounded-xl border px-6 py-12 text-center sm:py-16">
      <h2 className="mx-auto max-w-[30ch] text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        Write your first connect-and-sign test.
      </h2>
      <p className="text-muted-foreground mx-auto mt-5 max-w-[48ch] text-lg text-pretty">
        The getting-started guide covers install, wallet setup, the cache build, and the first spec.
      </p>
      <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
        <ButtonLink href={DOCS_URL} variant="soft">
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
  </Section>
);

export { DocsCta };
