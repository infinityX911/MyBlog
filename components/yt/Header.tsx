"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Sun, Moon, Menu, X, Download } from "lucide-react";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Disclaimer", href: "/disclaimer" },
];

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <header
      className={clsx(
        "tw:sticky tw:top-0 tw:z-50 tw:w-full tw:transition-all tw:duration-300",
        scrolled
          ? "tw:bg-[var(--bg-primary)]/95 tw:backdrop-blur-md tw:border-b tw:border-[var(--border)] tw:shadow-sm"
          : "tw:bg-[var(--bg-primary)]/80 tw:backdrop-blur-sm"
      )}
    >
      <div className="yt-container-pad">
        <div className="tw:flex tw:items-center tw:justify-between tw:h-16 tw:md:h-18">

          {/* ── LOGO ── */}
          <Link href="/" className="tw:flex tw:items-center tw:gap-2.5 tw:group tw:shrink-0">
            <div className="tw:relative tw:w-9 tw:h-9 tw:rounded-xl tw:bg-brand-red tw:flex tw:items-center tw:justify-center tw:shadow-red-glow-sm tw:group-hover:shadow-red-glow tw:transition-shadow tw:duration-300">
              <Download className="tw:w-5 tw:h-5 tw:text-white" strokeWidth={2.5} />
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-white/10 tw:opacity-0 tw:group-hover:opacity-100 tw:transition-opacity" />
            </div>
            <span className="tw:font-display tw:font-extrabold tw:text-[1.1rem] tw:tracking-tight tw:text-[var(--text-primary)]">
              My<span className="tw:text-brand-red">Tube</span>{" "}
              <span className="tw:font-semibold tw:opacity-70">Downloader</span>
            </span>
          </Link>

          {/* ── DESKTOP NAV ── */}
          <nav className="tw:hidden tw:md:flex tw:items-center tw:gap-1">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "tw:relative tw:px-3.5 tw:py-2 tw:text-sm tw:font-medium tw:rounded-lg tw:transition-all tw:duration-200",
                  pathname === href
                    ? "tw:text-brand-red tw:bg-brand-red/8"
                    : "tw:text-[var(--text-secondary)] tw:hover:text-[var(--text-primary)] tw:hover:bg-[var(--border)]"
                )}
              >
                {label}
                {pathname === href && (
                  <span className="tw:absolute tw:bottom-0.5 tw:left-1/2 tw:-translate-x-1/2 tw:w-1 tw:h-1 tw:rounded-full tw:bg-brand-red" />
                )}
              </Link>
            ))}
          </nav>

          {/* ── RIGHT ACTIONS ── */}
          <div className="tw:flex tw:items-center tw:gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark/light mode"
              className={clsx(
                "tw:w-9 tw:h-9 tw:rounded-xl tw:flex tw:items-center tw:justify-center tw:transition-all tw:duration-200",
                "tw:border tw:border-[var(--border)] tw:bg-[var(--bg-card)]",
                "tw:hover:border-brand-red/40 tw:hover:bg-brand-red/8 tw:hover:text-brand-red",
                "tw:text-[var(--text-muted)]"
              )}
            >
              {mounted ? (
                theme === "dark" ? (
                  <Sun className="tw:w-4.5 tw:h-4.5" />
                ) : (
                  <Moon className="tw:w-4.5 tw:h-4.5" />
                )
              ) : (
                <div className="tw:w-4 tw:h-4 tw:rounded-full tw:bg-[var(--border)] tw:animate-pulse" />
              )}
            </button>

            {/* CTA Button – desktop */}
            <Link
              href="/"
              className="tw:hidden tw:md:flex yt-btn-primary tw:items-center tw:gap-2 tw:text-sm tw:py-2.5 tw:animate-pulse-ring"
            >
              <Download className="tw:w-4 tw:h-4" />
              Download Free
            </Link>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
              className="tw:md:hidden tw:w-9 tw:h-9 tw:rounded-xl tw:flex tw:items-center tw:justify-center tw:border tw:border-[var(--border)] tw:bg-[var(--bg-card)] tw:text-[var(--text-primary)] tw:transition-all tw:duration-200 tw:hover:border-brand-red/40"
            >
              {menuOpen ? <X className="tw:w-4.5 tw:h-4.5" /> : <Menu className="tw:w-4.5 tw:h-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── MOBILE MENU ── */}
      <div
        className={clsx(
          "tw:md:hidden tw:overflow-hidden tw:transition-all tw:duration-300 tw:ease-in-out tw:border-t tw:border-[var(--border)]",
          menuOpen ? "tw:max-h-96 tw:opacity-100" : "tw:max-h-0 tw:opacity-0"
        )}
      >
        <nav className="yt-container-pad tw:py-4 tw:flex tw:flex-col tw:gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "tw:px-4 tw:py-3 tw:rounded-xl tw:text-sm tw:font-medium tw:transition-all tw:duration-200",
                pathname === href
                  ? "tw:text-brand-red tw:bg-brand-red/8 tw:font-semibold"
                  : "tw:text-[var(--text-secondary)] tw:hover:text-[var(--text-primary)] tw:hover:bg-[var(--border)]"
              )}
            >
              {label}
            </Link>
          ))}
          <div className="tw:pt-2 tw:border-t tw:border-[var(--border)] tw:mt-2">
            <Link href="/" className="yt-btn-primary tw:flex tw:items-center tw:justify-center tw:gap-2 tw:text-sm">
              <Download className="tw:w-4 tw:h-4" />
              Download Free
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
