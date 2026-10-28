import { Shield, Zap, Globe2, Download } from "lucide-react";

const STATS = [
  { value: "50M+", label: "Downloads" },
  { value: "12",   label: "Formats" },
  { value: "4K",   label: "Max Quality" },
  { value: "Free", label: "Always" },
];

const TRUST_BADGES = [
  { icon: Zap,     text: "Instant conversion" },
  { icon: Shield,  text: "No sign-up required" },
  { icon: Globe2,  text: "Works worldwide" },
  { icon: Download,text: "Unlimited downloads" },
];

export function Hero() {
  return (
    <section className="tw:relative tw:overflow-hidden tw:bg-hero-dark tw:dark:bg-hero-dark tw:light:bg-hero-light">
      {/* Background decorations */}
      <div className="tw:absolute tw:inset-0 tw:bg-hero-dark" aria-hidden />
      <div className="tw:absolute tw:top-0 tw:left-1/2 tw:-translate-x-1/2 tw:w-[900px] tw:h-[500px] tw:rounded-full tw:bg-brand-red/6 tw:blur-[120px] tw:pointer-events-none" />
      <div className="tw:absolute tw:-top-20 tw:-right-40 tw:w-80 tw:h-80 tw:rounded-full tw:bg-brand-red/8 tw:blur-[100px] tw:pointer-events-none" />

      <div className="tw:relative yt-container-pad yt-section-pad tw:text-center">
        {/* Eyebrow */}
        <div className="tw:inline-flex tw:items-center tw:gap-2 tw:bg-brand-red/12 tw:border tw:border-brand-red/25 tw:text-brand-red tw:text-xs tw:font-semibold tw:px-4 tw:py-2 tw:rounded-full tw:mb-6 tw:animate-fade-in">
          <span className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-brand-red tw:animate-pulse" />
          #1 Free YouTube Downloader — No Registration
        </div>

        {/* Headline */}
        <h1 className="tw:font-display tw:text-4xl tw:sm:text-5xl tw:md:text-6xl tw:lg:text-7xl tw:font-extrabold tw:leading-[1.08] tw:tracking-tight tw:text-white tw:mb-5 tw:animate-slide-up">
          Download YouTube{" "}
          <span className="tw:relative tw:inline-block">
            <span className="yt-text-gradient">Videos Free</span>
            {/* underline decoration */}
            <svg className="tw:absolute tw:-bottom-2 tw:left-0 tw:w-full" viewBox="0 0 300 8" fill="none" aria-hidden>
              <path d="M0 5 Q75 0 150 5 Q225 10 300 5" stroke="#E31C1C" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
            </svg>
          </span>
          <br />
          in Any Format
        </h1>

        {/* Sub-headline */}
        <p className="tw:text-brand-gray-400 tw:text-lg tw:md:text-xl tw:max-w-2xl tw:mx-auto tw:leading-relaxed tw:mb-8 tw:animate-slide-up yt-animate-delay-100 tw:text-balance">
          Convert YouTube videos to <strong className="tw:text-white tw:font-semibold">MP4, MP3, MKV, AVI, WEBM, WAV</strong> and more.
          HD quality, no watermarks, zero cost — the best free YouTube converter online.
        </p>

        {/* Trust badges */}
        <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-3 tw:mb-12 tw:animate-fade-in yt-animate-delay-200">
          {TRUST_BADGES.map(({ icon: Icon, text }) => (
            <div key={text} className="tw:flex tw:items-center tw:gap-1.5 tw:text-xs tw:text-brand-gray-400 tw:bg-white/[0.04] tw:border tw:border-white/[0.08] tw:rounded-full tw:px-3.5 tw:py-1.5">
              <Icon className="tw:w-3.5 tw:h-3.5 tw:text-brand-red" />
              {text}
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="tw:flex tw:items-center tw:justify-center tw:gap-8 tw:sm:gap-12 tw:animate-fade-in yt-animate-delay-300">
          {STATS.map(({ value, label }, i) => (
            <div key={label} className="tw:flex tw:flex-col tw:items-center tw:gap-0.5">
              <span className="tw:text-2xl tw:sm:text-3xl tw:font-display tw:font-extrabold tw:text-white tw:tracking-tight">{value}</span>
              <span className="tw:text-xs tw:text-brand-gray-400 tw:uppercase tw:tracking-widest">{label}</span>
              {i < STATS.length - 1 && (
                <div className="tw:absolute" aria-hidden />
              )}
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="tw:flex tw:justify-center tw:mt-14 tw:animate-bounce-sm">
          <div className="tw:w-5 tw:h-8 tw:rounded-full tw:border-2 tw:border-white/20 tw:flex tw:items-start tw:justify-center tw:pt-1.5">
            <div className="tw:w-1 tw:h-2 tw:rounded-full tw:bg-brand-red tw:animate-float" />
          </div>
        </div>
      </div>
    </section>
  );
}
