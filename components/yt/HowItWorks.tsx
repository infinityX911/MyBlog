import { ClipboardPaste, Settings2, Download } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: ClipboardPaste,
    title: "Paste the YouTube URL",
    desc: "Copy the link of any YouTube video from your browser address bar or the Share button. Paste it into our input box above.",
    tip: "Works with youtube.com, youtu.be, and mobile app links.",
  },
  {
    number: "02",
    icon: Settings2,
    title: "Choose Format & Quality",
    desc: "Select your output format (MP4, MP3, MKV, WEBM, AVI, WAV, and more) and pick your preferred resolution or audio bitrate.",
    tip: "MP4 720p is ideal for most devices. MP3 320kbps is best for music.",
  },
  {
    number: "03",
    icon: Download,
    title: "Download Instantly",
    desc: "Click the Download button. Your file is converted on our servers and ready within seconds — saved directly to your device.",
    tip: "No email, account, or software installation needed.",
  },
];

export function HowItWorks() {
  return (
    <section id="tw:how-it-works" className="yt-section-pad tw:bg-[var(--bg-primary)]">
      <div className="yt-container-pad">
        <div className="tw:text-center tw:mb-12">
          <h2 className="tw:font-display tw:text-3xl tw:md:text-4xl tw:font-extrabold tw:text-[var(--text-primary)] tw:mb-3">
            How to Download YouTube Videos
          </h2>
          <p className="tw:text-[var(--text-secondary)] tw:max-w-xl tw:mx-auto">
            Download any YouTube video in 3 simple steps — no technical knowledge required.
          </p>
        </div>

        <div className="tw:grid tw:md:grid-cols-3 tw:gap-6 tw:md:gap-8 tw:relative">
          {/* Connector line */}
          <div className="tw:hidden tw:md:block tw:absolute tw:top-12 tw:left-[calc(33%+2rem)] tw:right-[calc(33%+2rem)] tw:h-px tw:bg-linear-to-r tw:from-transparent tw:via-brand-red/30 tw:to-transparent" />

          {STEPS.map(({ number, icon: Icon, title, desc, tip }, i) => (
            <div
              key={number}
              className="tw:relative yt-card tw:p-6 tw:md:p-7 tw:text-center tw:animate-slide-up"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              {/* Number badge */}
              <div className="tw:inline-flex tw:items-center tw:justify-center tw:w-14 tw:h-14 tw:rounded-2xl tw:bg-brand-red/10 tw:border tw:border-brand-red/20 tw:mb-5 tw:mx-auto tw:relative">
                <Icon className="tw:w-6 tw:h-6 tw:text-brand-red" />
                <span className="tw:absolute tw:-top-2 tw:-right-2 tw:w-6 tw:h-6 tw:rounded-full tw:bg-brand-red tw:text-white tw:text-[10px] tw:font-bold tw:flex tw:items-center tw:justify-center">
                  {i + 1}
                </span>
              </div>
              <h3 className="tw:font-semibold tw:text-lg tw:text-[var(--text-primary)] tw:mb-2">{title}</h3>
              <p className="tw:text-sm tw:text-[var(--text-secondary)] tw:leading-relaxed tw:mb-4">{desc}</p>
              <div className="tw:text-xs tw:text-brand-red tw:bg-brand-red/8 tw:border tw:border-brand-red/15 tw:rounded-xl tw:px-3 tw:py-2">
                💡 {tip}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
