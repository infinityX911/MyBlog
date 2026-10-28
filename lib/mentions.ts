// lib/mentions.ts
// Shared helpers for @mentions in comments. A mention is stored inside the
// comment text as a token:  @[Display Name](userId)
// The textarea shows the readable "@Display Name"; on submit we swap the picked
// names for tokens, and on render the tokens become profile links.

export interface PickedMention { id: number; name: string }

/** Replace each picked "@Name" in the text with its "@[Name](id)" token. */
export function tokenizeMentions(content: string, mentions: PickedMention[]): string {
    let out = content;
    // Longest names first so "@Umair Ali" isn't half-matched by "@Umair".
    const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length);
    for (const m of sorted) {
        const needle = `@${m.name}`;
        const token = `@[${m.name}](${m.id})`;
        if (out.includes(needle)) out = out.split(needle).join(token);
    }
    return out;
}

/** Unique user ids referenced by @[Name](id) tokens in the content. */
export function extractMentionIds(content: string): number[] {
    const ids = new Set<number>();
    const re = /@\[[^\]]+\]\((\d+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) ids.add(Number(m[1]));
    return [...ids];
}
