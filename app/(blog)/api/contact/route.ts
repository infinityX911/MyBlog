/**
 * app/(blog)/api/contact/route.ts
 *
 * POST /api/contact  → public contact form. Emails the submission to the site's
 * configured address (Admin → Settings → email), falling back to SMTP_USER.
 * Anonymous-friendly (no login required); rate-limited per IP against spam.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deliverEmail } from '@/lib/delivery';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Characters that must never reach an email header, by code point.
 *
 *   10 LF, 13 CR   — the actual header separators
 *   9 TAB, 11 VT, 12 FF — treated as folding whitespace by some mail agents
 *   8232 / 8233    — Unicode line/paragraph separator, which several mail
 *                    libraries normalise into a real newline even though
 *                    JavaScript's own \n does not match them
 */
const HEADER_BREAKERS = new Set([10, 13, 9, 11, 12, 8232, 8233]);

/**
 * Collapse anything that could break out of an email header.
 *
 * `name` and `subject` are attacker-controlled and end up inside the Subject
 * line. A carriage return or newline there is how header injection works: the
 * rest of the string becomes a NEW header, so a submission could add its own
 * Bcc: and quietly turn this form into an open relay for spam.
 *
 * Nodemailer encodes headers and would very likely stop this by itself, but
 * "the library probably handles it" is not a control — removing the bytes is.
 *
 * Written as a code-point scan rather than a regex on purpose: a regex literal
 * containing a real line break is a syntax error, and that mistake is invisible
 * in review because the offending character is invisible. Comparing numbers
 * cannot go wrong that way.
 */
function headerSafe(s: string) {
    let out = '';
    let lastWasSpace = false;
    for (const ch of s) {
        if (HEADER_BREAKERS.has(ch.codePointAt(0) ?? 0)) {
            if (!lastWasSpace) {
                out += ' ';
                lastWasSpace = true;
            }
        } else {
            out += ch;
            lastWasSpace = false;
        }
    }
    return out.trim();
}

export async function POST(req: NextRequest) {
    const rl = rateLimit(`contact:${getClientIp(req.headers)}`, 5, 10 * 60 * 1000); // 5 / 10 min
    if (!rl.ok) {
        return NextResponse.json({ error: `Too many messages. Try again in ${rl.retryAfter}s.` }, { status: 429 });
    }

    try {
        const body = await req.json();
        const name = String(body.name || '').trim().slice(0, 120);
        const email = String(body.email || '').trim().slice(0, 200);
        const subject = String(body.subject || '').trim().slice(0, 200);
        const category = String(body.category || '').trim().slice(0, 60);
        const message = String(body.message || '').trim().slice(0, 5000);

        if (!name || !email || !message) {
            return NextResponse.json({ error: 'Name, email and message are required.' }, { status: 422 });
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 422 });
        }

        // Recipient: admin-configured email, else the SMTP account.
        const setting = await prisma.siteSetting
            .findUnique({ where: { siteKey: 'blog' }, select: { emailAddress: true } })
            .catch(() => null);
        const to = setting?.emailAddress?.trim() || process.env.SMTP_USER || process.env.SMTP_FROM || '';
        if (!to) {
            return NextResponse.json({ error: 'Contact email is not configured on the server.' }, { status: 500 });
        }

        const subjectLine = headerSafe(`[Contact] ${subject || category || 'New message'} — from ${name}`);
        const text = `New contact form message\n\nName: ${name}\nEmail: ${email}\nCategory: ${category || '-'}\nSubject: ${subject || '-'}\n\n${message}`;
        const html =
            `<h2>New contact form message</h2>` +
            `<p><b>Name:</b> ${escapeHtml(name)}<br>` +
            `<b>Email:</b> ${escapeHtml(email)}<br>` +
            `<b>Category:</b> ${escapeHtml(category || '-')}<br>` +
            `<b>Subject:</b> ${escapeHtml(subject || '-')}</p>` +
            `<hr><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;

        // reply-to would be nicer; deliverEmail keeps it simple (to/subject/body/html).
        await deliverEmail(to, subjectLine, text, html);
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[POST /api/contact]', e);
        return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
    }
}
