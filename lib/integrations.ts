// lib/integrations.ts
// Server-only resolver for admin-configurable integrations (Google Analytics /
// Search Console + image uploads). Values come from the DB (Admin → Blog →
// Integrations) and fall back to the matching .env var when a field is unset —
// so existing env-based setups keep working, but the dashboard now wins.
//
// SECURITY: the returned object contains secrets (GA private key, Cloudinary
// secret). Only pass NON-secret fields (measurementId, gscVerification) to client
// components. Never return this whole object to the browser.
import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';

export interface AnalyticsConfig {
    measurementId: string;   // G-XXXX (public tracking tag)
    ga4PropertyId: string;   // Data API property id
    clientEmail: string;     // Data API service account
    privateKey: string;      // Data API service account (SECRET)
    gscVerification: string; // Search Console token
}
export interface UploadConfig {
    provider: 'local' | 'cloudinary';
    cloudName: string;
    apiKey: string;
    apiSecret: string;       // SECRET
}
export interface EmailConfig {
    host: string;
    port: string;
    user: string;
    pass: string;            // SECRET
    from: string;
}
export interface Integrations {
    analytics: AnalyticsConfig;
    upload: UploadConfig;
    email: EmailConfig;
}

const s = (v: unknown, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback);

function fromEnv(): Integrations {
    return {
        analytics: {
            measurementId: s(process.env.NEXT_PUBLIC_GA_ID),
            ga4PropertyId: s(process.env.GA4_PROPERTY_ID),
            clientEmail: s(process.env.GOOGLE_CLIENT_EMAIL),
            privateKey: process.env.GOOGLE_PRIVATE_KEY ?? '',
            gscVerification: s(process.env.NEXT_PUBLIC_GSC_VERIFICATION),
        },
        upload: {
            provider: (process.env.UPLOAD_PROVIDER ?? '').toLowerCase() === 'cloudinary' ? 'cloudinary' : 'local',
            cloudName: s(process.env.CLOUDINARY_CLOUD_NAME),
            apiKey: s(process.env.CLOUDINARY_API_KEY),
            apiSecret: s(process.env.CLOUDINARY_API_SECRET),
        },
        email: {
            host: s(process.env.SMTP_HOST),
            port: s(process.env.SMTP_PORT),
            user: s(process.env.SMTP_USER),
            pass: process.env.SMTP_PASS ?? '',
            from: s(process.env.SMTP_FROM),
        },
    };
}

/** Full config (with secrets) for server-side use. DB value → env fallback. */
export const getIntegrations = cache(async (siteKey = 'blog'): Promise<Integrations> => {
    const env = fromEnv();
    try {
        const row: any = await prisma.siteSetting.findUnique({ where: { siteKey } });
        if (!row) return env;
        return {
            analytics: {
                measurementId: s(row.gaMeasurementId, env.analytics.measurementId),
                ga4PropertyId: s(row.ga4PropertyId, env.analytics.ga4PropertyId),
                clientEmail: s(row.gaClientEmail, env.analytics.clientEmail),
                privateKey: (typeof row.gaPrivateKey === 'string' && row.gaPrivateKey.trim()) ? row.gaPrivateKey : env.analytics.privateKey,
                gscVerification: s(row.gscVerification, env.analytics.gscVerification),
            },
            upload: {
                provider: s(row.uploadProvider, env.upload.provider).toLowerCase() === 'cloudinary' ? 'cloudinary' : 'local',
                cloudName: s(row.cloudinaryCloud, env.upload.cloudName),
                apiKey: s(row.cloudinaryKey, env.upload.apiKey),
                apiSecret: (typeof row.cloudinarySecret === 'string' && row.cloudinarySecret.trim()) ? row.cloudinarySecret : env.upload.apiSecret,
            },
            email: {
                host: s(row.smtpHost, env.email.host),
                port: s(row.smtpPort, env.email.port),
                user: s(row.smtpUser, env.email.user),
                pass: (typeof row.smtpPass === 'string' && row.smtpPass.trim()) ? row.smtpPass : env.email.pass,
                from: s(row.smtpFrom, env.email.from),
            },
        };
    } catch (e) {
        console.error('[getIntegrations]', e);
        return env;
    }
});
