/**
 * components/yt/faq-data.ts
 *
 * FAQ content shared by the FAQ accordion (client component) AND the
 * FAQPage JSON-LD structured data emitted server-side on the homepage.
 * Kept in a plain module (no "use client") so both sides can import it.
 * One source of truth → the rich-result markup can never drift from the
 * visible answers (a Google spam-policy requirement).
 */

export const FAQS = [
  {
    q: "Is My Tube Downloader really free to use?",
    a: "Yes! My Tube Downloader is 100% free with no hidden charges, no subscription fees, and no download limits. You can download as many YouTube videos as you want without ever paying a cent or creating an account.",
  },
  {
    q: "What video formats does My Tube Downloader support?",
    a: "We support all major video and audio formats including MP4 (H.264), MKV, WEBM, AVI, MOV, FLV for video, and MP3, WAV, AAC, FLAC, OGG, M4A for audio. You can choose your preferred format and quality before downloading.",
  },
  {
    q: "What is the maximum video quality I can download?",
    a: "My Tube Downloader supports video quality up to 4K Ultra HD (2160p) for videos where that quality is available on YouTube. You can also choose from 1080p Full HD, 720p HD, 480p, or 360p depending on your needs and connection speed.",
  },
  {
    q: "Do I need to install any software or browser extension?",
    a: "No installation required! My Tube Downloader is a 100% web-based tool. Simply paste your YouTube URL into the input field on our homepage, select your desired format and quality, and click download — it works in any modern browser on any device.",
  },
  {
    q: "How do I download a YouTube video using this tool?",
    a: "It's very simple: (1) Copy the YouTube video URL from your browser or the YouTube app. (2) Paste the URL into the input box on our homepage. (3) Click 'Get Video' to fetch the video info. (4) Select your preferred format (MP4, MP3, etc.) and quality. (5) Click the Download button. Your file will be ready in seconds.",
  },
  {
    q: "Is it legal to download YouTube videos?",
    a: "Downloading YouTube videos for personal offline viewing may be permissible in some jurisdictions, but it does violate YouTube's Terms of Service. We strongly advise only downloading videos you have the rights to, such as your own uploads or content with Creative Commons licenses. Please review our Disclaimer for full details.",
  },
  {
    q: "Why is my YouTube video download failing?",
    a: "Download failures can occur if the video is age-restricted, set to private, geo-blocked in your region, or protected by YouTube's DRM. Additionally, very long videos (3+ hours) may take more time to process. Try refreshing and pasting the URL again, or try a different format.",
  },
  {
    q: "Can I download YouTube videos on iPhone or Android?",
    a: "Yes! My Tube Downloader is fully responsive and works on all mobile browsers including Safari on iPhone and Chrome on Android. Simply open our website in your mobile browser, paste the YouTube link, and download your chosen format.",
  },
  {
    q: "What is the best format for downloading YouTube music?",
    a: "For music, we recommend MP3 at 320kbps for the best balance of quality and file size, or FLAC if you want lossless audio quality. WAV is also lossless but produces larger files. AAC at 256kbps is excellent for Apple device users.",
  },
  {
    q: "How fast is the YouTube video conversion?",
    a: "Most conversions complete within 10–30 seconds depending on video length and your internet speed. High-resolution videos (1080p/4K) may take slightly longer. Our servers are optimized for speed, and there's no queue — your conversion starts immediately.",
  },
  {
    q: "How do I download a YouTube video in 1080p or 4K?",
    a: "Paste the YouTube link, click Get Video, then open the Quality dropdown and choose 1080p or 4K. We only show the resolutions the video actually offers, so if 4K appears, the original upload supports it. Higher resolutions produce larger files and take a little longer to prepare.",
  },
  {
    q: "Can I download a YouTube video as an MP3?",
    a: "Yes. Switch to the Audio tab, choose MP3 (or WAV, FLAC, AAC, OGG, M4A), pick a bitrate up to 320kbps, and download. This is the fastest way to save a song, podcast, or lecture from YouTube for offline listening.",
  },
  {
    q: "Can I download YouTube Shorts?",
    a: "Yes — paste the Shorts link exactly as you would a normal video URL. It works with standard youtube.com links, shortened youtu.be links, and Shorts links alike.",
  },
];
