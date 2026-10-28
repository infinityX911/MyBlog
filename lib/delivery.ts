/**
 * lib/delivery.ts
 *
 * Provider-agnostic delivery for emails and SMS.
 *
 * EMAIL: if SMTP env vars are set, sends a real email via nodemailer.
 *        Otherwise (dev / not configured) it logs to the server console so
 *        the reset flow still works end-to-end.
 *
 *   Free Gmail setup (recommended):
 *     1) Google account → Security → enable 2-Step Verification
 *     2) Security → App passwords → create one for "Mail"
 *     3) In .env:
 *          SMTP_HOST=smtp.gmail.com
 *          SMTP_PORT=465
 *          SMTP_USER=youraddress@gmail.com
 *          SMTP_PASS=the-16-char-app-password
 *          SMTP_FROM="Your Site <youraddress@gmail.com>"
 *     4) `npm install` (adds nodemailer), then restart.
 *
 * SMS: still logs to console. Wire any gateway (Twilio / Vonage / a local
 *      PK HTTP gateway) in deliverSms() — many are just a fetch() POST.
 */

export async function deliverEmail(
    to: string,
    subject: string,
    body: string,
    html?: string,
): Promise<void> {
    // SMTP config comes from Admin -> Blog -> Integrations (DB) first, then the
    // SMTP_* env vars as a fallback, so email can be configured from the admin
    // panel without editing the server's .env.production.
    let host = '', user = '', pass = '', from = '', portStr = '';
    try {
        const { getIntegrations } = await import('@/lib/integrations');
        const e = (await getIntegrations()).email;
        host = e.host; user = e.user; pass = e.pass; from = e.from; portStr = e.port;
    } catch {
        host = process.env.SMTP_HOST ?? ''; user = process.env.SMTP_USER ?? '';
        pass = process.env.SMTP_PASS ?? ''; from = process.env.SMTP_FROM ?? ''; portStr = process.env.SMTP_PORT ?? '';
    }

    if (host && user && pass) {
        try {
            const nodemailer = (await import('nodemailer' as any)).default;
            const port = Number(portStr) || 465;
            const transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
                auth: { user, pass },
                // Fail fast instead of hanging forever on a blocked SMTP port
                // (many VPS providers block 465/587 outbound) so the UI doesn't
                // sit on "Sending..." — the caller then falls back to logging.
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
                tls: {
                    rejectUnauthorized:
                        process.env.SMTP_STRICT_TLS === 'true' ||
                        process.env.NODE_ENV === 'production',
                },
            });
            await transporter.sendMail({
                from: from || user,
                to,
                subject,
                text: body,
                html: html ?? `<pre style="font-family:inherit;white-space:pre-wrap">${body}</pre>`,
            });
            return;
        } catch (err) {
            console.error('[deliverEmail] SMTP send failed, falling back to log:', err);
        }
    }

    console.log('\n──────── EMAIL (dev: SMTP not configured) ────────');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(body);
    console.log('──────────────────────────────────────────────────\n');
}

export async function deliverSms(to: string, body: string): Promise<void> {
    // Generic HTTP gateway. Most SMS providers (Twilio, Vonage, and most local
    // Pakistani gateways like Telenor/Jazz/BulkSMS) are a single HTTP POST, so
    // this works with almost any of them via env config — no SDK needed.
    //
    //   SMS_API_URL   = https://gateway.example.com/send      (required to enable)
    //   SMS_API_METHOD= POST                                   (default POST)
    //   SMS_API_AUTH  = Bearer xxx   OR   Basic xxx            (optional header)
    //   SMS_TO_FIELD  = to            (json field name for recipient, default "to")
    //   SMS_MSG_FIELD = message       (json field name for text, default "message")
    //   SMS_FROM      = YourBrand     (optional sender id, sent as "from")
    //   SMS_EXTRA     = {"api_key":"..."}   (optional extra JSON merged into body)
    const url = process.env.SMS_API_URL;
    if (url) {
        try {
            const toField = process.env.SMS_TO_FIELD || 'to';
            const msgField = process.env.SMS_MSG_FIELD || 'message';
            const extra = process.env.SMS_EXTRA ? JSON.parse(process.env.SMS_EXTRA) : {};
            const payload: Record<string, unknown> = {
                [toField]: to,
                [msgField]: body,
                ...(process.env.SMS_FROM ? { from: process.env.SMS_FROM } : {}),
                ...extra,
            };
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (process.env.SMS_API_AUTH) headers['Authorization'] = process.env.SMS_API_AUTH;

            const res = await fetch(url, {
                method: process.env.SMS_API_METHOD || 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            if (!res.ok) console.error('[deliverSms] gateway responded', res.status, await res.text().catch(() => ''));
            return;
        } catch (err) {
            console.error('[deliverSms] gateway send failed, falling back to log:', err);
        }
    }

    console.log('\n──────── SMS (dev: SMS_API_URL not set) ────────');
    console.log(`To: ${to}`);
    console.log(body);
    console.log('────────────────────────────────────────────────\n');
}
