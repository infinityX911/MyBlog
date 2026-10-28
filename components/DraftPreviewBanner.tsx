// components/DraftPreviewBanner.tsx
// Small fixed banner shown at the BOTTOM of a page/post when an admin is viewing an
// UNPUBLISHED draft via ?preview=1. Makes it obvious this isn't the live page.
export default function DraftPreviewBanner({ status }: { status?: string }) {
    return (
        <div
            role="status"
            style={{
                // Fixed to the BOTTOM (not top) so it never sits in the page flow
                // and push the fixed navbar / tutorial top-strip down (that left a
                // gap under the navbar in preview). Still clearly visible.
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 4000,
                background: 'linear-gradient(90deg,#f59e0b,#f97316)',
                color: '#fff',
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.2,
                padding: '8px 14px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            }}
        >
            👁 Draft preview — this is how the {status === 'draft' ? 'draft' : 'unpublished'} page will look once published. Not visible to the public.
        </div>
    );
}
