"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { FAQS } from "./faq-data";

// FAQ content lives in faq-data.ts (shared with server-side JSON-LD).

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="yt-section-pad tw:bg-[var(--bg-secondary)]">
      <div className="yt-container-pad">
        <div className="tw:text-center tw:mb-12">
          <h2 className="tw:font-display tw:text-3xl tw:md:text-4xl tw:font-extrabold tw:text-[var(--text-primary)] tw:mb-3">
            Frequently Asked Questions
          </h2>
          <p className="tw:text-[var(--text-secondary)] tw:max-w-xl tw:mx-auto">
            Everything you need to know about downloading YouTube videos with My Tube Downloader.
          </p>
        </div>

        {/* Schema.org FAQ structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQS.map(({ q, a }) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
              })),
            }),
          }}
        />

        <div className="tw:max-w-3xl tw:mx-auto tw:space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <div
              key={i}
              className={clsx(
                "yt-card tw:overflow-hidden tw:transition-all tw:duration-200",
                openIndex === i && "tw:border-brand-red/30 tw:shadow-red-glow-sm"
              )}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="tw:w-full tw:flex tw:items-start tw:justify-between tw:gap-4 tw:p-5 tw:text-left"
                aria-expanded={openIndex === i}
              >
                <span className={clsx(
                  "tw:font-semibold tw:text-sm tw:md:text-base tw:leading-snug tw:transition-colors",
                  openIndex === i ? "tw:text-brand-red" : "tw:text-[var(--text-primary)]"
                )}>
                  {q}
                </span>
                <ChevronDown
                  className={clsx(
                    "tw:w-5 tw:h-5 tw:shrink-0 tw:mt-0.5 tw:text-[var(--text-muted)] tw:transition-all tw:duration-300",
                    openIndex === i && "tw:rotate-180 tw:text-brand-red"
                  )}
                />
              </button>
              <div
                className={clsx(
                  "tw:overflow-hidden tw:transition-all tw:duration-300",
                  openIndex === i ? "tw:max-h-96 tw:opacity-100" : "tw:max-h-0 tw:opacity-0"
                )}
              >
                <p className="tw:px-5 tw:pb-5 tw:text-sm tw:text-[var(--text-secondary)] tw:leading-relaxed">
                  {a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
