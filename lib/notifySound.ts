/**
 * lib/notifySound.ts
 *
 * Tiny "new message" ping using the Web Audio API — no audio file/asset needed.
 * Browsers block audio until the user has interacted with the page at least
 * once, so the very first proactive greeting may be silent; every message after
 * any click/keypress plays normally.
 */

let ctx: AudioContext | null = null;

export function playPing() {
    if (typeof window === 'undefined') return;
    try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx = ctx || new AC();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Two short rising tones — a friendly "ding-ding".
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(880, now + 0.12);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

        osc.start(now);
        osc.stop(now + 0.3);
    } catch { /* audio not available — ignore */ }
}
