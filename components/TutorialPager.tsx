// components/TutorialPager.tsx
// Bottom-of-lesson navigation shown when a post/page is part of a tutorial.
//
// Both buttons are ALWAYS rendered: Previous on the left, Next on the right.
// The one that has nowhere to go is disabled rather than hidden, so the pair
// keeps its shape on the first and last lesson instead of collapsing into a
// single lonely button. Pure server component — links + a disabled span.
import Link from 'next/link';
import type { TutorialLink } from '@/lib/tutorial-lookup';
import s from './TutorialLayout.module.css';

function Btn({
    link,
    dir,
    fallbackLabel,
}: {
    link: TutorialLink | null;
    dir: 'prev' | 'next';
    fallbackLabel: string;
}) {
    const cls = `${s.pagerBtn} ${dir === 'prev' ? s.pagerPrev : s.pagerNext}`;
    const arrow = dir === 'prev' ? '← Previous' : 'Next →';

    if (!link) {
        return (
            <span className={`${cls} ${s.pagerDisabled}`} aria-disabled="true">
                <span className={s.pagerDir}>{arrow}</span>
                <span className={s.pagerLabel}>{fallbackLabel}</span>
            </span>
        );
    }
    return (
        <Link href={link.href} className={cls}>
            <span className={s.pagerDir}>{arrow}</span>
            <span className={s.pagerLabel}>{link.label}</span>
        </Link>
    );
}

export default function TutorialPager({ prev, next }: { prev: TutorialLink | null; next: TutorialLink | null }) {
    return (
        <nav className={s.pager} aria-label="Lesson navigation">
            <Btn link={prev} dir="prev" fallbackLabel="Start of tutorial" />
            <Btn link={next} dir="next" fallbackLabel="End of tutorial" />
        </nav>
    );
}
