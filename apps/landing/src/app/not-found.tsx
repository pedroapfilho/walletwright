import type { Metadata } from "next";
import Link from "next/link";

const metadata: Metadata = {
  title: "Page not found",
};

const NotFound = () => (
  <main className="ref-measure" id="main-content" tabIndex={-1}>
    <section aria-label="Page not found" className="ref-hero">
      <div>
        <h1 className="ref-wordmark">Page not found</h1>
        <p className="ref-lede">There is no page at this address.</p>
        <div className="ref-actions">
          <Link className="ref-btn ref-btn-primary" href="/">
            Back to walletwright
          </Link>
        </div>
      </div>
    </section>
  </main>
);

export { metadata };
export default NotFound;
