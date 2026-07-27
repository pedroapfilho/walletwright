import { CodeExample } from "@/components/code-example";
import { DocsCta } from "@/components/docs-cta";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Wallets } from "@/components/wallets";

const Page = () => (
  <>
    <SiteHeader />
    {/* tabIndex is required for Safari to actually move focus on the skip link. */}
    <main className="focus:outline-none" id="main-content" tabIndex={-1}>
      <Hero />
      <CodeExample />
      <Wallets />
      <Features />
      <DocsCta />
    </main>
    <SiteFooter />
  </>
);

export default Page;
