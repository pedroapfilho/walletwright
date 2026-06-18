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
    <main>
      <Hero />
      <Wallets />
      <Features />
      <CodeExample />
      <DocsCta />
    </main>
    <SiteFooter />
  </>
);

export default Page;
