"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import {
  Download, Link2, X, CheckCircle2, AlertCircle,
  Loader2, Film, Music, ChevronDown, Sparkles,
  Play, Clock, Eye,
} from "lucide-react";
import clsx from "clsx";

// ─── Types ───────────────────────────────────────────────────────────
type FormatCategory = "VIDEO" | "AUDIO";
type DownloadStatus = "idle" | "fetching" | "ready" | "downloading" | "done" | "error";

interface Format {
  id: string;
  name: string;
  label: string;
  ext: string;
  category: FormatCategory;
  badge?: string;
  badgeColor?: string;
  qualities?: string[];
  icon: string;
}

interface VideoInfo {
  title: string;
  duration: string;
  views: string;
  thumbnail: string;
  channelName: string;
  maxHeight: number; // highest resolution this video actually has (0 = unknown)
}

// ─── Static format catalogue (replace with API call to /api/formats) ─
const FORMATS: Format[] = [
  // VIDEO
  { id: "mp4",  name: "MP4",  label: "MP4 – HD Video",  ext: "mp4",  category: "VIDEO", badge: "Popular", badgeColor: "red",  icon: "🎬", qualities: ["360p","480p","720p","1080p","4K"] },
  { id: "mkv",  name: "MKV",  label: "MKV – Ultra HD",  ext: "mkv",  category: "VIDEO", badge: "HD",      badgeColor: "blue", icon: "🎥", qualities: ["720p","1080p","4K"] },
  { id: "webm", name: "WEBM", label: "WEBM – Web Video", ext: "webm", category: "VIDEO", icon: "📹", qualities: ["360p","480p","720p","1080p"] },
  { id: "avi",  name: "AVI",  label: "AVI – Classic",    ext: "avi",  category: "VIDEO", icon: "🎞️", qualities: ["360p","480p","720p"] },
  { id: "mov",  name: "MOV",  label: "MOV – Apple",      ext: "mov",  category: "VIDEO", icon: "🍎", qualities: ["360p","480p","720p","1080p"] },
  { id: "flv",  name: "FLV",  label: "FLV – Flash",      ext: "flv",  category: "VIDEO", icon: "⚡", qualities: ["360p","480p"] },
  // AUDIO
  { id: "mp3",  name: "MP3",  label: "MP3 – Music",  ext: "mp3",  category: "AUDIO", badge: "Popular", badgeColor: "red",  icon: "🎵", qualities: ["128kbps","192kbps","256kbps","320kbps"] },
  { id: "wav",  name: "WAV",  label: "WAV – Lossless",   ext: "wav",  category: "AUDIO", badge: "HQ",      badgeColor: "green",icon: "🎶", qualities: ["Lossless"] },
  { id: "aac",  name: "AAC",  label: "AAC – Apple Audio", ext: "aac",  category: "AUDIO", icon: "🎸", qualities: ["128kbps","192kbps","256kbps"] },
  { id: "ogg",  name: "OGG",  label: "OGG – Open Audio",  ext: "ogg",  category: "AUDIO", icon: "🎹", qualities: ["128kbps","192kbps"] },
  { id: "flac", name: "FLAC", label: "FLAC – Hi-Res",     ext: "flac", category: "AUDIO", badge: "HiFi",    badgeColor: "purple", icon: "🎼", qualities: ["Lossless"] },
  { id: "m4a",  name: "M4A",  label: "M4A – iTunes",      ext: "m4a",  category: "AUDIO", icon: "🎙️", qualities: ["128kbps","192kbps","256kbps"] },
];

const VIDEO_FORMATS = FORMATS.filter((f) => f.category === "VIDEO");
const AUDIO_FORMATS = FORMATS.filter((f) => f.category === "AUDIO");

// ─── Helpers ─────────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:v=|\/embed\/|\.be\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isValidYouTubeUrl(url: string): boolean {
  return !!extractVideoId(url.trim());
}

// Map a quality label to its pixel height ("1080p" -> 1080, "4K" -> 2160).
function qualityToHeight(q: string): number | null {
  const m = q.match(/(\d{3,4})p/);
  if (m) return Number(m[1]);
  if (/4k/i.test(q)) return 2160;
  return null; // audio labels
}

// Only offer qualities the video actually has (no 4K option on a 1080p video).
// Before the info fetch (maxHeight = 0) the full list is shown as a preview.
function availableQualities(fmt: Format, maxHeight: number): string[] {
  const all = fmt.qualities ?? [];
  if (fmt.category === "AUDIO" || !maxHeight) return all;
  const filtered = all.filter((q) => {
    const h = qualityToHeight(q);
    return h === null || h <= maxHeight;
  });
  return filtered.length ? filtered : all.slice(0, 1); // very low-res videos: keep lowest tier
}

// Badge colors
const BADGE_STYLES: Record<string, string> = {
  red:    "tw:bg-brand-red/15 tw:text-brand-red tw:border-brand-red/30",
  blue:   "tw:bg-blue-500/15 tw:text-blue-400 tw:border-blue-400/30",
  green:  "tw:bg-emerald-500/15 tw:text-emerald-400 tw:border-emerald-400/30",
  purple: "tw:bg-purple-500/15 tw:text-purple-400 tw:border-purple-400/30",
};

// ─── Sub-components ───────────────────────────────────────────────────
function FormatCard({
  fmt, selected, onClick,
}: {
  fmt: Format;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "tw:relative tw:group tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-2 tw:p-4 tw:rounded-2xl tw:border tw:transition-all tw:duration-200 tw:cursor-pointer tw:text-center",
        selected
          ? "tw:border-brand-red tw:bg-brand-red/8 tw:shadow-red-glow-sm tw:scale-[1.03]"
          : "tw:border-[var(--border)] tw:bg-[var(--bg-card)] tw:hover:border-brand-red/40 tw:hover:bg-[var(--bg-card-hover)] tw:hover:scale-[1.02]"
      )}
    >
      {fmt.badge && (
        <span className={clsx(
          "tw:absolute tw:-top-2 tw:-right-2 tw:text-[9px] tw:font-bold tw:px-2 tw:py-0.5 tw:rounded-full tw:border",
          BADGE_STYLES[fmt.badgeColor ?? "red"]
        )}>
          {fmt.badge}
        </span>
      )}
      <span className="tw:text-2xl tw:leading-none">{fmt.icon}</span>
      <span className={clsx(
        "tw:text-sm tw:font-bold tw:tracking-wide tw:transition-colors",
        selected ? "tw:text-brand-red" : "tw:text-[var(--text-primary)]"
      )}>
        {fmt.name}
      </span>
      <span className="tw:text-[10px] tw:text-[var(--text-muted)] tw:leading-tight tw:hidden tw:sm:block">
        {fmt.label.split("–")[1]?.trim() ?? ""}
      </span>
      {selected && (
        <CheckCircle2 className="tw:w-4 tw:h-4 tw:text-brand-red tw:absolute tw:top-2 tw:left-2" />
      )}
    </button>
  );
}

function QualitySelector({
  qualities,
  selected,
  onChange,
}: {
  qualities: string[];
  selected: string;
  onChange: (q: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Menu position in VIEWPORT coords — the menu renders in a portal on <body>,
  // so no ancestor's `overflow-hidden` (like the tool card) can clip it.
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  // Measure the trigger just before paint (and on scroll/resize while open) so
  // the floating menu stays glued to the button.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  return (
    <div className="tw:relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="yt-input-base tw:flex tw:items-center tw:justify-between tw:gap-2 tw:w-48 tw:text-sm"
      >
        <span>{selected}</span>
        <ChevronDown className={clsx("tw:w-4 tw:h-4 tw:transition-transform tw:text-[var(--text-muted)]", open && "tw:rotate-180")} />
      </button>
      {open && rect && typeof document !== "undefined" && createPortal(
        <>
          {/* full-screen backdrop: click anywhere outside → close */}
          <div
            onClick={() => setOpen(false)}
            className="tw:fixed tw:inset-0 tw:z-[999]"
          />
          <div
            className="tw:fixed tw:z-[1000] yt-card tw:shadow-card-dark tw:py-1 tw:animate-scale-in tw:max-h-64 tw:overflow-auto"
            style={{ top: rect.top, left: rect.left, width: rect.width }}
          >
            {qualities.map((q) => (
              <button
                key={q}
                onClick={() => { onChange(q); setOpen(false); }}
                className={clsx(
                  "tw:w-full tw:text-left tw:px-4 tw:py-2.5 tw:text-sm tw:transition-colors",
                  q === selected
                    ? "tw:text-brand-red tw:bg-brand-red/8 tw:font-semibold"
                    : "tw:text-[var(--text-secondary)] tw:hover:bg-[var(--bg-card-hover)] tw:hover:text-[var(--text-primary)]"
                )}
              >
                {q}
                {q === selected && <CheckCircle2 className="tw:inline tw:w-3.5 tw:h-3.5 tw:ml-2" />}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────
export function ToolForm() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [activeCategory, setActiveCategory] = useState<FormatCategory>("VIDEO");
  const [selectedFormat, setSelectedFormat] = useState<Format>(FORMATS[0]);
  const [selectedQuality, setSelectedQuality] = useState<string>(FORMATS[0].qualities?.[2] ?? "720p");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  // number = real download %, null = server is still converting (indeterminate)
  const [progress, setProgress] = useState<number | null>(0);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFormatSelect = useCallback((fmt: Format) => {
    setSelectedFormat(fmt);
    const opts = availableQualities(fmt, videoInfo?.maxHeight ?? 0);
    setSelectedQuality(
      fmt.category === "AUDIO"
        ? opts[opts.length - 1] ?? ""
        : opts[Math.min(2, opts.length - 1)] ?? opts[0] ?? ""
    );
    if (fmt.category !== activeCategory) setActiveCategory(fmt.category);
  }, [activeCategory, videoInfo]);

  const handleUrlChange = (v: string) => {
    setUrl(v);
    if (urlError) setUrlError("");
    if (status === "error") setStatus("idle");
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      setUrlError("");
    } catch {
      inputRef.current?.focus();
    }
  };

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setUrlError("Please paste a YouTube URL first."); return; }
    if (!isValidYouTubeUrl(trimmed)) { setUrlError("Invalid YouTube URL. Please check and try again."); return; }

    setStatus("fetching");
    setVideoInfo(null);
    setProgress(0);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/yt/info?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        // `detail` is yt-dlp's own stderr. The tool is owner-only, so showing it
        // is safe — and without it every failure reads the same from here, with
        // no server console to check on a hosted box.
        setUrlError(
          data.detail
            ? `${data.error || "Could not fetch video info."}\n\n${data.detail}`
            : (data.error || "Could not fetch video info."),
        );
        setStatus("idle");
        return;
      }
      const mh: number = data.maxHeight ?? 0;
      setVideoInfo({
        title: data.title,
        duration: data.durationLabel,
        views: data.viewLabel,
        thumbnail: data.thumbnail,
        channelName: data.channel,
        maxHeight: mh,
      });
      // Clamp the pre-selected quality to what this video actually offers.
      const opts = availableQualities(selectedFormat, mh);
      if (!opts.includes(selectedQuality)) {
        setSelectedQuality(opts[opts.length - 1] ?? "");
      }
      setStatus("ready");
    } catch {
      setUrlError("Network error while fetching video info. Please try again.");
      setStatus("idle");
    }
  };

  const handleDownload = async () => {
    const id = extractVideoId(url.trim());
    if (!id) { setUrlError("Invalid YouTube URL."); return; }

    setStatus("downloading");
    setProgress(null); // phase 1: server converting -> indeterminate bar
    setErrorMsg("");

    const url_ = `/api/yt/download?url=${encodeURIComponent(url.trim())}` +
      `&ext=${encodeURIComponent(selectedFormat.ext)}` +
      `&quality=${encodeURIComponent(selectedQuality)}` +
      `&title=${encodeURIComponent(videoInfo?.title ?? "")}`;

    try {
      // The server converts + merges FIRST (that's the wait), then streams the
      // finished file with a real Content-Length. So: indeterminate while we
      // wait for headers, then byte-accurate progress while the file arrives.
      const res = await fetch(url_);
      if (!res.ok) {
        let msg = "Download failed. The video may be unavailable in this format.";
        try {
          const body = await res.json();
          msg = body.error || msg;
          // Owner-only tool: show yt-dlp's / the server's actual reason rather
          // than a generic line that gives nothing to act on.
          if (body.detail) msg += `\n\n${body.detail}`;
        } catch { /* body was a stream, not JSON */ }
        throw new Error(msg);
      }

      const total = Number(res.headers.get("Content-Length") || 0);
      let blob: Blob;
      if (res.body && total > 0) {
        const reader = res.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;
        setProgress(0); // phase 2: real download progress
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setProgress(Math.min(100, Math.round((received / total) * 100)));
        }
        blob = new Blob(chunks, { type: res.headers.get("Content-Type") || undefined });
      } else {
        blob = await res.blob(); // no length header -> just wait it out
      }
      setProgress(100);

      // Trigger the browser "Save file" flow from the received blob.
      // Prefer the UTF-8 filename* (real title), fall back to ASCII filename=.
      const cd = res.headers.get("Content-Disposition") || "";
      const star = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const plain = cd.match(/filename="?([^";]+)"?/i);
      const filename = star
        ? decodeURIComponent(star[1])
        : plain?.[1] || `${videoInfo?.title || "mytube-" + id}.${selectedFormat.ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);

      await new Promise((r) => setTimeout(r, 300));
      setStatus("done");
    } catch (e) {
      setErrorMsg((e as Error).message);
      setStatus("error");
    }
  };

  const handleReset = () => {
    setUrl("");
    setVideoInfo(null);
    setStatus("idle");
    setProgress(0);
    setErrorMsg("");
    setUrlError("");
    inputRef.current?.focus();
  };

  const displayFormats = activeCategory === "VIDEO" ? VIDEO_FORMATS : AUDIO_FORMATS;
  const qualityOptions = availableQualities(selectedFormat, videoInfo?.maxHeight ?? 0);

  return (
    <div id="tool" className="tw:w-full">

      {/* ── URL INPUT ROW ── */}
      <div className="tw:space-y-3 tw:mb-8">
        <div className={clsx(
          "tw:flex tw:items-center tw:gap-2 tw:p-2 tw:rounded-2xl tw:border tw:transition-all tw:duration-200",
          "tw:bg-[var(--bg-card)] tw:shadow-card-light tw:dark:shadow-card-dark",
          urlError ? "tw:border-red-500/60" : "tw:border-[var(--border-strong)] tw:focus-within:border-brand-red tw:focus-within:shadow-red-glow-sm"
        )}>
          <div className="tw:flex-1 tw:flex tw:items-center tw:gap-3 tw:pl-2">
            <Link2 className={clsx("tw:w-5 tw:h-5 tw:shrink-0 tw:transition-colors", url ? "tw:text-brand-red" : "tw:text-[var(--text-muted)]")} />
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && status === "idle" && handleFetch()}
              placeholder="Paste YouTube URL here... e.g. https://youtube.com/watch?v=..."
              className="tw:flex-1 tw:bg-transparent tw:outline-hidden tw:text-[var(--text-primary)] tw:placeholder:text-[var(--text-muted)] tw:text-sm tw:md:text-base tw:py-2"
              disabled={status === "fetching" || status === "downloading"}
              autoComplete="off"
              spellCheck={false}
            />
            {url && (
              <button onClick={() => handleUrlChange("")} className="tw:text-[var(--text-muted)] tw:hover:text-[var(--text-primary)] tw:transition-colors tw:p-1 tw:rounded-lg">
                <X className="tw:w-4 tw:h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handlePaste}
            className="tw:hidden tw:sm:flex tw:items-center tw:gap-1.5 tw:text-xs tw:font-medium tw:text-[var(--text-muted)] tw:hover:text-[var(--text-primary)] tw:border tw:border-[var(--border)] tw:rounded-xl tw:px-3 tw:py-2.5 tw:transition-all tw:hover:bg-[var(--bg-card-hover)]"
          >
            📋 Paste
          </button>
          <button
            onClick={handleFetch}
            disabled={status === "fetching" || status === "downloading"}
            className="yt-btn-primary tw:flex tw:items-center tw:gap-2 tw:text-sm tw:whitespace-nowrap"
          >
            {status === "fetching" ? (
              <><Loader2 className="tw:w-4 tw:h-4 tw:animate-spin" /> Fetching…</>
            ) : (
              <><Sparkles className="tw:w-4 tw:h-4" /> Get Video</>
            )}
          </button>
        </div>

        {urlError && (
          <div className="tw:flex tw:items-start tw:gap-2 tw:text-red-400 tw:text-sm tw:animate-slide-down">
            <AlertCircle className="tw:w-4 tw:h-4 tw:shrink-0 tw:mt-0.5" />
            {/* pre-wrap so the yt-dlp detail keeps its line breaks */}
            <span className="tw:whitespace-pre-wrap tw:break-words tw:min-w-0">{urlError}</span>
          </div>
        )}
      </div>

      {/* ── FORMAT TABS ── */}
      <div className="tw:mb-5">
        <div className="tw:flex tw:items-center tw:gap-1 tw:mb-4 tw:bg-[var(--bg-card)] tw:border tw:border-[var(--border)] tw:rounded-xl tw:p-1 tw:w-fit">
          {(["VIDEO", "AUDIO"] as FormatCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                const first = cat === "VIDEO" ? VIDEO_FORMATS[0] : AUDIO_FORMATS[0];
                handleFormatSelect(first);
              }}
              className={clsx(
                "tw:flex tw:items-center tw:gap-2 tw:px-5 tw:py-2 tw:rounded-lg tw:text-sm tw:font-semibold tw:transition-all tw:duration-200",
                activeCategory === cat
                  ? "tw:bg-brand-red tw:text-white tw:shadow-btn-red"
                  : "tw:text-[var(--text-muted)] tw:hover:text-[var(--text-primary)]"
              )}
            >
              {cat === "VIDEO" ? <Film className="tw:w-4 tw:h-4" /> : <Music className="tw:w-4 tw:h-4" />}
              {cat === "VIDEO" ? "Video" : "Audio"}
            </button>
          ))}
        </div>

        <div className="tw:grid tw:grid-cols-3 tw:sm:grid-cols-4 tw:md:grid-cols-6 tw:gap-3">
          {displayFormats.map((fmt) => (
            <FormatCard
              key={fmt.id}
              fmt={fmt}
              selected={selectedFormat.id === fmt.id}
              onClick={() => handleFormatSelect(fmt)}
            />
          ))}
        </div>
      </div>

      {/* ── QUALITY SELECTOR (only qualities this video actually has) ── */}
      {qualityOptions.length > 0 && (
        <div className="tw:relative tw:z-30 tw:flex tw:items-center tw:gap-3 tw:mb-6 tw:animate-fade-in">
          <span className="tw:text-sm tw:text-[var(--text-muted)] tw:font-medium">Quality:</span>
          <QualitySelector
            qualities={qualityOptions}
            selected={selectedQuality}
            onChange={setSelectedQuality}
          />
          <span className="tw:text-xs tw:text-[var(--text-muted)] tw:hidden tw:sm:block">
            Format: <span className="tw:font-semibold tw:text-[var(--text-primary)]">.{selectedFormat.ext}</span>
          </span>
          {videoInfo && videoInfo.maxHeight > 0 && selectedFormat.category === "VIDEO" && (
            <span className="tw:text-xs tw:text-[var(--text-muted)]">
              Source max:{" "}
              <span className="tw:font-semibold tw:text-[var(--text-primary)]">
                {videoInfo.maxHeight >= 2160 ? "4K" : `${videoInfo.maxHeight}p`}
              </span>
            </span>
          )}
        </div>
      )}

      {/* ── VIDEO INFO CARD ── */}
      {videoInfo && status !== "idle" && (
        <div className="yt-card tw:p-4 tw:mb-6 tw:animate-scale-in">
          <div className="tw:flex tw:gap-4">
            <div className="tw:relative tw:shrink-0 tw:w-28 tw:sm:w-36 tw:aspect-video tw:rounded-xl tw:overflow-hidden tw:bg-[var(--bg-secondary)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="tw:w-full tw:h-full tw:object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'><rect fill='%231A1A1A' width='16' height='9'/><text x='8' y='5.5' fill='%23666' font-size='3' text-anchor='middle'>▶ Video</text></svg>`;
                }}
              />
              <div className="tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center tw:bg-black/30">
                <Play className="tw:w-6 tw:h-6 tw:text-white" fill="white" />
              </div>
            </div>
            <div className="tw:flex-1 tw:min-w-0 tw:space-y-1.5">
              <h3 className="tw:font-semibold tw:text-sm tw:leading-snug tw:text-[var(--text-primary)] tw:line-clamp-2">
                {videoInfo.title}
              </h3>
              <p className="tw:text-xs tw:text-[var(--text-muted)]">{videoInfo.channelName}</p>
              <div className="tw:flex tw:items-center tw:gap-3 tw:text-xs tw:text-[var(--text-muted)]">
                <span className="tw:flex tw:items-center tw:gap-1"><Clock className="tw:w-3 tw:h-3" />{videoInfo.duration}</span>
                <span className="tw:flex tw:items-center tw:gap-1"><Eye className="tw:w-3 tw:h-3" />{videoInfo.views} views</span>
              </div>
              <div className="tw:flex tw:items-center tw:gap-2 tw:flex-wrap">
                <span className="tw:text-xs tw:bg-brand-red/10 tw:text-brand-red tw:border tw:border-brand-red/20 tw:rounded-lg tw:px-2.5 tw:py-1 tw:font-semibold">
                  {selectedFormat.name} · {selectedQuality}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROGRESS BAR ── */}
      {status === "downloading" && (
        <div className="tw:mb-6 tw:space-y-2 tw:animate-fade-in">
          <div className="tw:flex tw:justify-between tw:items-center tw:text-xs tw:text-[var(--text-muted)]">
            <span>
              {progress === null
                ? "Converting on our server… HD & 4K can take a minute"
                : "Downloading to your device…"}
            </span>
            {progress !== null && (
              <span className="tw:font-semibold tw:text-brand-red">{Math.round(progress)}%</span>
            )}
          </div>
          <div className="tw:h-2.5 tw:rounded-full tw:bg-[var(--bg-secondary)] tw:overflow-hidden tw:border tw:border-[var(--border)]">
            <div
              className={clsx(
                "tw:h-full tw:rounded-full yt-progress-bar tw:transition-all tw:duration-300",
                progress === null && "tw:animate-pulse"
              )}
              style={{ width: progress === null ? "100%" : `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── DOWNLOAD / DONE BUTTON ── */}
      {(status === "ready" || status === "downloading" || status === "done") && (
        <div className="tw:flex tw:flex-col tw:sm:flex-row tw:gap-3 tw:animate-slide-up">
          {status === "done" ? (
            <div className="tw:flex-1 tw:flex tw:items-center tw:justify-center tw:gap-3 tw:p-4 tw:rounded-2xl tw:bg-emerald-500/10 tw:border tw:border-emerald-500/30 tw:text-emerald-400">
              <CheckCircle2 className="tw:w-5 tw:h-5" />
              <span className="tw:font-semibold">Download complete! Check your downloads folder.</span>
            </div>
          ) : (
            <button
              onClick={handleDownload}
              disabled={status === "downloading"}
              className={clsx(
                "tw:flex-1 yt-btn-primary tw:flex tw:items-center tw:justify-center tw:gap-2 tw:py-3.5 tw:text-base",
                status === "downloading" && "tw:opacity-80 tw:cursor-not-allowed"
              )}
            >
              {status === "downloading" ? (
                <><Loader2 className="tw:w-5 tw:h-5 tw:animate-spin" />{" "}
                  {progress === null ? "Converting…" : `Downloading… ${Math.round(progress)}%`}</>
              ) : (
                <><Download className="tw:w-5 tw:h-5" /> Download {selectedFormat.name} · {selectedQuality}</>
              )}
            </button>
          )}
          <button
            onClick={handleReset}
            className="yt-btn-secondary tw:flex tw:items-center tw:justify-center tw:gap-2 tw:py-3.5 tw:text-sm tw:sm:w-auto"
          >
            <X className="tw:w-4 tw:h-4" />
            New Download
          </button>
        </div>
      )}

      {/* ERROR STATE */}
      {status === "error" && (
        <div className="tw:flex tw:flex-col tw:sm:flex-row tw:items-start tw:sm:items-center tw:gap-3 tw:p-4 tw:rounded-2xl tw:bg-red-500/10 tw:border tw:border-red-500/30 tw:animate-scale-in">
          <AlertCircle className="tw:w-5 tw:h-5 tw:text-red-400 tw:shrink-0" />
          <div className="tw:flex-1">
            <p className="tw:font-semibold tw:text-red-400 tw:text-sm">Download failed</p>
            {/* pre-wrap + break-words so the server's raw reason stays readable */}
            <p className="tw:text-xs tw:text-[var(--text-muted)] tw:mt-0.5 tw:whitespace-pre-wrap tw:break-words">
              {errorMsg || "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <button onClick={handleReset} className="yt-btn-secondary tw:text-sm tw:py-2">Try Again</button>
        </div>
      )}

      {/* DISCLAIMER */}
      <p className="tw:mt-5 tw:text-center tw:text-xs tw:text-[var(--text-muted)] tw:leading-relaxed">
        For personal use only. Downloading copyrighted material without permission may violate{" "}
        <a href="/disclaimer" className="tw:text-brand-red tw:hover:underline">YouTube&apos;s Terms of Service</a>.
        Please review our <a href="/disclaimer" className="tw:text-brand-red tw:hover:underline">Disclaimer</a>.
      </p>
    </div>
  );
}
