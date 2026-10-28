const VIDEO_FORMATS = [
  { name: "MP4",  desc: "Universal video format. Compatible with all devices, phones, TVs, and editing software.", quality: "Up to 4K", badge: "Most Popular" },
  { name: "MKV",  desc: "High-quality container with multi-audio and subtitle support. Ideal for home theatre.", quality: "Up to 4K", badge: "HD" },
  { name: "WEBM", desc: "Open-source web format. Perfect for embedding videos on websites or web projects.", quality: "Up to 1080p", badge: null },
  { name: "AVI",  desc: "Classic Windows format. High compatibility with older media players and systems.", quality: "Up to 720p", badge: null },
  { name: "MOV",  desc: "Native Apple QuickTime format. Best for iPhone, iPad, and Mac users.", quality: "Up to 1080p", badge: null },
  { name: "FLV",  desc: "Legacy Flash video format. Use for retro compatibility or older streaming setups.", quality: "Up to 480p", badge: null },
];

const AUDIO_FORMATS = [
  { name: "MP3",  desc: "The world's most popular audio format. Works on every device and music player.", quality: "Up to 320kbps", badge: "Most Popular" },
  { name: "WAV",  desc: "Uncompressed lossless audio. Studio quality, preferred by audio engineers.", quality: "Lossless", badge: "Lossless" },
  { name: "FLAC", desc: "Free Lossless Audio Codec. Perfect audiophile quality in a compressed file.", quality: "Lossless", badge: "Hi-Fi" },
  { name: "AAC",  desc: "Advanced Audio Coding. Better than MP3 at the same bitrate. Used by Apple.", quality: "Up to 256kbps", badge: null },
  { name: "OGG",  desc: "Open-source audio format with excellent compression. Great for streaming.", quality: "Up to 192kbps", badge: null },
  { name: "M4A",  desc: "Apple's audio format used in iTunes. High quality with small file size.", quality: "Up to 256kbps", badge: null },
];

function FormatRow({ name, desc, quality, badge }: { name: string; desc: string; quality: string; badge: string | null }) {
  return (
    <div className="yt-card tw:p-4 tw:hover:border-brand-red/30 tw:hover:shadow-red-glow-sm tw:transition-all tw:duration-200 tw:group">
      <div className="tw:flex tw:items-start tw:gap-3">
        <div className="tw:w-12 tw:h-10 tw:shrink-0 tw:rounded-lg tw:bg-brand-red/10 tw:border tw:border-brand-red/20 tw:flex tw:items-center tw:justify-center tw:group-hover:bg-brand-red/15 tw:transition-colors">
          <span className="tw:text-xs tw:font-bold tw:text-brand-red">{name}</span>
        </div>
        <div className="tw:flex-1 tw:min-w-0">
          <div className="tw:flex tw:items-center tw:gap-2 tw:mb-1 tw:flex-wrap">
            <span className="tw:font-semibold tw:text-sm tw:text-[var(--text-primary)]">{name}</span>
            {badge && (
              <span className="tw:text-[9px] tw:bg-brand-red/10 tw:text-brand-red tw:border tw:border-brand-red/25 tw:px-2 tw:py-0.5 tw:rounded-full tw:font-bold tw:uppercase tw:tracking-wide">
                {badge}
              </span>
            )}
            <span className="tw:text-[10px] tw:text-[var(--text-muted)] tw:ml-auto">{quality}</span>
          </div>
          <p className="tw:text-xs tw:text-[var(--text-muted)] tw:leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export function SupportedFormats() {
  return (
    <section id="formats" className="yt-section-pad tw:bg-[var(--bg-secondary)]">
      <div className="yt-container-pad">
        <div className="tw:text-center tw:mb-12">
          <h2 className="tw:font-display tw:text-3xl tw:md:text-4xl tw:font-extrabold tw:text-[var(--text-primary)] tw:mb-3">
            All Supported YouTube Converter Formats
          </h2>
          <p className="tw:text-[var(--text-secondary)] tw:max-w-2xl tw:mx-auto">
            My Tube Downloader supports <strong>12 output formats</strong> covering every use case —
            from HD video downloads to studio-quality audio extraction.
          </p>
        </div>

        <div className="tw:grid tw:lg:grid-cols-2 tw:gap-10">
          {/* Video column */}
          <div>
            <div className="tw:flex tw:items-center tw:gap-2 tw:mb-4">
              <span className="tw:text-xl">🎬</span>
              <h3 className="tw:font-display tw:text-xl tw:font-bold tw:text-[var(--text-primary)]">Video Formats</h3>
              <span className="tw:text-xs tw:bg-[var(--bg-card)] tw:border tw:border-[var(--border)] tw:px-2.5 tw:py-1 tw:rounded-full tw:text-[var(--text-muted)]">6 formats</span>
            </div>
            <div className="tw:space-y-3">
              {VIDEO_FORMATS.map((f) => <FormatRow key={f.name} {...f} />)}
            </div>
          </div>

          {/* Audio column */}
          <div>
            <div className="tw:flex tw:items-center tw:gap-2 tw:mb-4">
              <span className="tw:text-xl">🎵</span>
              <h3 className="tw:font-display tw:text-xl tw:font-bold tw:text-[var(--text-primary)]">Audio Formats</h3>
              <span className="tw:text-xs tw:bg-[var(--bg-card)] tw:border tw:border-[var(--border)] tw:px-2.5 tw:py-1 tw:rounded-full tw:text-[var(--text-muted)]">6 formats</span>
            </div>
            <div className="tw:space-y-3">
              {AUDIO_FORMATS.map((f) => <FormatRow key={f.name} {...f} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
