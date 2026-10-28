// app/api/generate-alt-text/route.ts
//
// Generates SEO-friendly alt text for an uploaded image.
// The client picks which Vision provider to use via the `provider` field
// in the request body ('openai' | 'google'); whichever one the editor's
// dropdown has selected is sent. If a provider's API key isn't configured,
// we return a clear error so the UI can fall back / inform the user
// instead of silently failing.
//
// Required env vars (only the one(s) you actually use need to be set):
//   OPENAI_API_KEY=sk-...
//   GOOGLE_CLOUD_VISION_API_KEY=...
//
// Security: requires the 'create-posts' permission (post authors only — not
// every logged-in account, since these hit PAID third-party APIs), is rate
// limited to curb cost abuse, and rejects non-http(s) image URLs.

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, userId } from '@/lib/rbac';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';

type Provider = 'openai' | 'google';

function isSafeHttpUrl(url: string) {
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

async function toAbsoluteUrl(req: NextRequest, imageUrl: string) {
    // Local uploads come back as relative paths like /uploads/blog/xyz.webp —
    // Vision APIs need a publicly fetchable absolute URL.
    if (imageUrl.startsWith('/')) {
        const origin = req.nextUrl.origin;
        return `${origin}${imageUrl}`;
    }
    return imageUrl;
}

async function generateWithOpenAI(imageUrl: string, focusKeyword: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');

    const prompt = focusKeyword
        ? `Write a concise, SEO-friendly alt text (max 125 characters) describing this image for a blog post. Naturally include the keyword "${focusKeyword}" if it genuinely fits the image — never force it if it doesn't. Describe what is visually in the image. Do not start with "Image of" or "Picture of". Return only the alt text, nothing else.`
        : `Write a concise, SEO-friendly alt text (max 125 characters) describing this image for a blog post. Describe what is visually in the image. Do not start with "Image of" or "Picture of". Return only the alt text, nothing else.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 80,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageUrl } },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`OpenAI Vision request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI returned an empty response.');
    return text.replace(/^["']|["']$/g, '').slice(0, 160);
}

async function generateWithGoogleVision(imageUrl: string, focusKeyword: string): Promise<string> {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_CLOUD_VISION_API_KEY is not configured on the server.');

    // Google Cloud Vision's standard API doesn't generate prose captions —
    // it gives labels + objects. We compose those into a natural,
    // SEO-friendly alt text string ourselves.
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [
                {
                    image: { source: { imageUri: imageUrl } },
                    features: [
                        { type: 'LABEL_DETECTION', maxResults: 6 },
                        { type: 'OBJECT_LOCALIZATION', maxResults: 4 },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Google Vision request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const result = data?.responses?.[0];
    if (result?.error) throw new Error(result.error.message ?? 'Google Vision returned an error.');

    const labels: string[] = (result?.labelAnnotations ?? [])
        .map((l: any) => l.description)
        .filter(Boolean);
    const objects: string[] = (result?.localizedObjectAnnotations ?? [])
        .map((o: any) => o.name)
        .filter(Boolean);

    const terms = Array.from(new Set([...objects, ...labels])).slice(0, 4);
    if (terms.length === 0) throw new Error('Google Vision could not identify the image content.');

    let altText = terms.join(', ');
    if (focusKeyword && !altText.toLowerCase().includes(focusKeyword.toLowerCase())) {
        altText = `${focusKeyword} — ${altText}`;
    }
    // Capitalize first letter, trim to a reasonable alt-text length
    altText = altText.charAt(0).toUpperCase() + altText.slice(1);
    return altText.slice(0, 160);
}

export async function POST(req: NextRequest) {
    // Only post authors may call the paid Vision APIs — not every logged-in
    // account (a commenter could otherwise rack up OpenAI/Google charges).
    const auth = await requirePermission('create-posts');
    if (auth.error) return auth.error;

    // Cost guard: cap calls per author+IP (these hit paid third-party APIs).
    const ip = getClientIp(req.headers);
    const rl = rateLimit(`alt-text:${userId(auth.session)}:${ip}`, 30, 10 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: `Too many alt-text requests. Try again in ${rl.retryAfter}s.` },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
        );
    }

    let body: { imageUrl?: string; provider?: Provider; focusKeyword?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { imageUrl, provider, focusKeyword = '' } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
        return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }

    const absoluteUrl = await toAbsoluteUrl(req, imageUrl);
    if (!isSafeHttpUrl(absoluteUrl)) {
        return NextResponse.json({ error: 'imageUrl must be a valid http(s) URL' }, { status: 400 });
    }

    const chosenProvider: Provider = provider === 'google' ? 'google' : 'openai';

    try {
        const altText = chosenProvider === 'google'
            ? await generateWithGoogleVision(absoluteUrl, focusKeyword)
            : await generateWithOpenAI(absoluteUrl, focusKeyword);

        return NextResponse.json({ altText, provider: chosenProvider });
    } catch (err: any) {
        console.error('Alt-text generation failed:', err);
        return NextResponse.json(
            { error: err?.message ?? 'Alt-text generation failed.' },
            { status: 502 }
        );
    }
}
