import Link from "next/link";
import { Download } from "lucide-react";
// Lucide removed brand icons (Facebook/Youtube/Twitter/Instagram) in the
// version this project uses — pull them from react-icons instead. They accept
// className just like lucide components, so usage below is unchanged.
import { FaYoutube, FaXTwitter, FaFacebook, FaInstagram } from "react-icons/fa6";

const FOOTER_LINKS = {
  tools: [
    { label: "YouTube to MP4", href: "/#tool" },
    { label: "YouTube to MP3", href: "/#tool" },
    { label: "YouTube to MKV", href: "/#tool" },
    { label: "YouTube to WEBM", href: "/#tool" },
    { label: "YouTube to AVI", href: "/#tool" },
    { label: "YouTube to WAV", href: "/#tool" },
  ],
  company: [
    { label: "Home", href: "/" },
    { label: "About Us", href: "/about" },
    { label: "Contact Us", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Disclaimer", href: "/disclaimer" },
  ],
  support: [
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Supported Formats", href: "/#formats" },
    { label: "FAQs", href: "/#faq" },
    { label: "Report an Issue", href: "/contact" },
    { label: "Changelog", href: "#" },
  ],
};

const SOCIAL_LINKS = [
  {
    label: "YouTube",
    href: "https://youtube.com",
    icon: FaYoutube,
    hoverClass: "tw:hover:text-social-youtube tw:hover:bg-social-youtube/10 tw:hover:border-social-youtube/30",
  },
  {
    label: "Twitter / X",
    href: "https://twitter.com",
    icon: FaXTwitter,
    hoverClass: "tw:hover:text-social-twitter tw:hover:bg-social-twitter/10 tw:hover:border-social-twitter/30",
  },
  {
    label: "Facebook",
    href: "https://facebook.com",
    icon: FaFacebook,
    hoverClass: "tw:hover:text-social-facebook tw:hover:bg-social-facebook/10 tw:hover:border-social-facebook/30",
  },
  {
    label: "Instagram",
    href: "https://instagram.com",
    icon: FaInstagram,
    hoverClass: "tw:hover:text-social-instagram tw:hover:bg-social-instagram/10 tw:hover:border-social-instagram/30",
  },
];

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="tw:text-[var(--text-primary)] tw:font-semibold tw:text-sm tw:mb-4 tw:tracking-wide tw:uppercase">
      {children}
    </h3>
  );
}
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="tw:text-[var(--text-muted)] tw:text-sm tw:hover:text-brand-red tw:transition-colors tw:duration-200 tw:hover:translate-x-0.5 tw:inline-block tw:transition-transform"
      >
        {children}
      </Link>
    </li>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="tw:bg-[var(--bg-secondary)] tw:border-t tw:border-[var(--border)] tw:mt-auto">
      {/* ── Red accent strip ── */}
      <div className="tw:h-1 tw:bg-red-gradient" />

      {/* ── Main grid ── */}
      <div className="yt-container-pad tw:py-14">
        <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-4 tw:gap-10">

          {/* COL 1: Brand */}
          <div className="tw:space-y-5">
            <Link href="/" className="tw:flex tw:items-center tw:gap-2.5 tw:group tw:w-fit">
              <div className="tw:w-9 tw:h-9 tw:rounded-xl tw:bg-brand-red tw:flex tw:items-center tw:justify-center tw:shadow-red-glow-sm tw:group-hover:shadow-red-glow tw:transition-shadow tw:duration-300">
                <Download className="tw:w-5 tw:h-5 tw:text-white" strokeWidth={2.5} />
              </div>
              <span className="tw:font-display tw:font-extrabold tw:text-[1.05rem] tw:text-[var(--text-primary)]">
                My<span className="tw:text-brand-red">Tube</span>{" "}
                <span className="tw:font-semibold tw:opacity-70 tw:text-sm">Downloader</span>
              </span>
            </Link>
            <p className="tw:text-[var(--text-muted)] tw:text-sm tw:leading-relaxed">
              The fastest, free YouTube video downloader and format converter.
              No sign-up, no watermarks — just instant HD downloads in any format you need.
            </p>

            {/* Social Icons */}
            <div className="tw:flex tw:items-center tw:gap-2.5 tw:pt-1">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon, hoverClass }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`tw:w-9 tw:h-9 tw:rounded-xl tw:border tw:border-[var(--border)] tw:text-[var(--text-muted)]
                    tw:flex tw:items-center tw:justify-center tw:transition-all tw:duration-250 ${hoverClass}`}
                >
                  <Icon className="tw:w-4 tw:h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* COL 2: Tools */}
          <div>
            <FooterHeading>Converters</FooterHeading>
            <ul className="tw:space-y-2.5">
              {FOOTER_LINKS.tools.map((l) => (
                <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>
              ))}
            </ul>
          </div>

          {/* COL 3: Company */}
          <div>
            <FooterHeading>Company</FooterHeading>
            <ul className="tw:space-y-2.5">
              {FOOTER_LINKS.company.map((l) => (
                <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>
              ))}
            </ul>
          </div>

          {/* COL 4: Support */}
          <div>
            <FooterHeading>Support</FooterHeading>
            <ul className="tw:space-y-2.5">
              {FOOTER_LINKS.support.map((l) => (
                <FooterLink key={l.label} href={l.href}>{l.label}</FooterLink>
              ))}
            </ul>
            {/* Newsletter teaser */}
            <div className="tw:mt-6 tw:p-4 tw:rounded-xl tw:bg-brand-red/8 tw:border tw:border-brand-red/20">
              <p className="tw:text-xs tw:font-semibold tw:text-brand-red tw:mb-1">100% Free, Always</p>
              <p className="tw:text-xs tw:text-[var(--text-muted)]">
                No limits, no watermarks, no sign-up required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="tw:border-t tw:border-[var(--border)]">
        <div className="yt-container-pad tw:py-5 tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-between tw:gap-3">
          <p className="tw:text-xs tw:text-[var(--text-muted)] tw:text-center tw:sm:text-left">
            © {year} My Tube Downloader. All rights reserved. For personal use only.
          </p>
          <div className="tw:flex tw:items-center tw:gap-4">
            {["Privacy Policy", "Disclaimer"].map((t, i) => (
              <Link
                key={t}
                href={i === 0 ? "/privacy" : "/disclaimer"}
                className="tw:text-xs tw:text-[var(--text-muted)] tw:hover:text-brand-red tw:transition-colors"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
