'use client'
// components/MentionInput.tsx
// A textarea with @mention autocomplete (Facebook/YouTube style). Type "@" then
// a name to see a dropdown of users; pick one to insert "@Name". The parent
// tracks picked mentions and tokenizes them on submit (see lib/mentions).

import { useEffect, useRef, useState } from 'react'
import type { PickedMention } from '@/lib/mentions'

type U = { id: number; name: string; username: string | null; avatarUrl: string | null }

export default function MentionInput({
    value, onChange, onPickMention, placeholder, rows = 3, maxLength = 2000, autoFocus,
}: {
    value: string
    onChange: (v: string) => void
    onPickMention: (m: PickedMention) => void
    placeholder?: string
    rows?: number
    maxLength?: number
    autoFocus?: boolean
}) {
    const ref = useRef<HTMLTextAreaElement>(null)
    const mentionStart = useRef(-1)
    const [results, setResults] = useState<U[]>([])
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(0)
    const [query, setQuery] = useState('')

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const v = e.target.value
        onChange(v)
        const pos = e.target.selectionStart ?? v.length
        // An "@" that starts a word, followed by up to 30 non-space chars.
        const m = v.slice(0, pos).match(/(?:^|\s)@([^\s@]{0,30})$/)
        if (m) {
            mentionStart.current = pos - m[1].length - 1
            setQuery(m[1]); setOpen(true)
        } else {
            setOpen(false); setQuery('')
        }
    }

    useEffect(() => {
        if (!open || query.length < 1) { setResults([]); return }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
                const d = await res.json()
                setResults((d.users ?? []).slice(0, 6))
                setActive(0)
            } catch { setResults([]) }
        }, 160)
        return () => clearTimeout(t)
    }, [query, open])

    function pick(u: U) {
        const el = ref.current
        if (!el || mentionStart.current < 0) return
        const pos = el.selectionStart ?? value.length
        const before = value.slice(0, mentionStart.current)
        const after = value.slice(pos)
        const insert = `@${u.name} `
        onChange(before + insert + after)
        onPickMention({ id: u.id, name: u.name })
        setOpen(false); setResults([]); setQuery('')
        requestAnimationFrame(() => {
            el.focus()
            const caret = (before + insert).length
            el.setSelectionRange(caret, caret)
        })
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (!open || results.length === 0) return
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % results.length) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + results.length) % results.length) }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(results[active]) }
        else if (e.key === 'Escape') { setOpen(false) }
    }

    return (
        <div style={{ position: 'relative' }}>
            <textarea
                ref={ref}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                placeholder={placeholder}
                rows={rows}
                maxLength={maxLength}
                autoFocus={autoFocus}
            />
            {open && results.length > 0 && (
                <ul className="mention-dropdown">
                    {results.map((u, i) => (
                        <li
                            key={u.id}
                            className={`mention-item${i === active ? ' active' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); pick(u) }}
                        >
                            {u.avatarUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={u.avatarUrl} alt="" className="mention-av" referrerPolicy="no-referrer" />
                                : <span className="mention-av-fallback">{u.name.charAt(0).toUpperCase()}</span>}
                            <span className="mention-name">{u.name}</span>
                            {u.username && <span className="mention-handle">@{u.username}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
