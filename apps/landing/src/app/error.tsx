"use client";

import { useEffect, useRef } from "react";

type RouteErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

const RouteError = ({ error, retry }: RouteErrorProps) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <main className="ref-measure" id="main-content" tabIndex={-1}>
      <section aria-label="Something went wrong" className="ref-hero">
        <div>
          <h1 className="ref-wordmark" ref={headingRef} tabIndex={-1}>
            Something went wrong
          </h1>
          <p className="ref-lede">
            This page failed to load. Try again, and if it keeps happening, come back in a few
            minutes.
          </p>
          <div className="ref-actions">
            <button className="ref-btn ref-btn-primary" onClick={retry} type="button">
              Try again
            </button>
          </div>
          {error.digest !== undefined && <p className="ref-caption">Reference: {error.digest}</p>}
        </div>
      </section>
    </main>
  );
};

export default RouteError;
