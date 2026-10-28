/**
 * lib/notificationVisuals.tsx
 *
 * Icon + colour for each notification / activity type.
 *
 * Admins choose the mapping from Management → Notification Icons; those rows
 * (type → icon name + colour) are stored in the `notification_icons` table.
 * This file holds:
 *   - ICON_REGISTRY: the actual icon components, keyed by a stable name the
 *     admin picks from (the DB only stores the name string, never a component).
 *   - resolveVisual(): turn a type + the admin's config map into a renderable
 *     {icon, background}.
 *   - getNotificationVisual(): built-in fallback used before the config loads
 *     or for any type the admin hasn't customised.
 */

import React from 'react';
import {
    MessageSquare, CornerDownLeft, Mail, UserPlus, Bell, Heart, Star,
    ShoppingCart, FileText, Megaphone, ShieldCheck, ThumbsUp, Pencil,
    LogIn, UserCheck, Trash2, Settings, Tag, Image as ImageIcon,
    type LucideIcon,
} from 'lucide-react';

const ICON_STYLE = { color: 'white', size: 16 } as const;

// The pretty icons an admin can pick from. Key = stable name stored in DB.
export const ICON_REGISTRY: Record<string, LucideIcon> = {
    bell: Bell,
    message: MessageSquare,
    reply: CornerDownLeft,
    mail: Mail,
    userPlus: UserPlus,
    userCheck: UserCheck,
    heart: Heart,
    star: Star,
    cart: ShoppingCart,
    file: FileText,
    megaphone: Megaphone,
    shield: ShieldCheck,
    thumbsUp: ThumbsUp,
    pencil: Pencil,
    login: LogIn,
    trash: Trash2,
    settings: Settings,
    tag: Tag,
    image: ImageIcon,
};

export const ICON_NAMES = Object.keys(ICON_REGISTRY);

// A nice default palette the admin can pick from quickly.
export const COLOR_PRESETS = [
    'rgba(43, 119, 229, 0.9)',   // blue
    'rgba(8, 88, 247, 0.9)',     // royal
    'rgba(26, 159, 83, 0.9)',    // green
    'rgba(190, 14, 225, 0.9)',   // purple
    'rgba(234, 88, 12, 0.9)',    // orange
    'rgba(220, 38, 38, 0.9)',    // red
    'rgba(202, 138, 4, 0.9)',    // amber
    'rgba(13, 148, 136, 0.9)',   // teal
    'rgba(100, 100, 100, 0.9)',  // grey
];

export interface NotificationVisual {
    icon: React.ReactNode;
    background: string;
}

export type IconConfigMap = Record<string, { icon: string; color: string }>;

/** Render an icon by registry name (falls back to Bell). */
export function renderIcon(name: string, color: string = 'white'): React.ReactNode {
    const Cmp = ICON_REGISTRY[name] ?? Bell;
    return <Cmp color={color} size={ICON_STYLE.size} />;
}

// Built-in defaults — used as a fallback when no admin config exists.
const FALLBACK: Record<string, { icon: string; color: string }> = {
    comment:          { icon: 'message',  color: 'rgba(43, 119, 229, 0.9)' },
    'comment.create': { icon: 'message',  color: 'rgba(43, 119, 229, 0.9)' },
    comment_reply:    { icon: 'reply',    color: 'rgba(8, 88, 247, 0.9)' },
    mention:          { icon: 'message',  color: 'rgba(108, 99, 255, 0.9)' },
    'comment.reaction': { icon: 'heart',  color: 'rgba(224, 36, 94, 0.9)' },
    contact:          { icon: 'mail',     color: 'rgba(26, 159, 83, 0.9)' },
    register:         { icon: 'userPlus', color: 'rgba(190, 14, 225, 0.9)' },
    'user.register':  { icon: 'userPlus', color: 'rgba(190, 14, 225, 0.9)' },
    'user.update':    { icon: 'userCheck',color: 'rgba(13, 148, 136, 0.9)' },
    'user.status':    { icon: 'shield',   color: 'rgba(202, 138, 4, 0.9)' },
    'auth.login':     { icon: 'login',    color: 'rgba(26, 159, 83, 0.9)' },
    'profile.update': { icon: 'pencil',   color: 'rgba(8, 88, 247, 0.9)' },
    'profile.password':{ icon: 'shield',  color: 'rgba(220, 38, 38, 0.9)' },
    'post.create':    { icon: 'file',     color: 'rgba(234, 88, 12, 0.9)' },
    'post.update':    { icon: 'pencil',   color: 'rgba(234, 88, 12, 0.9)' },
    'post.delete':    { icon: 'trash',    color: 'rgba(220, 38, 38, 0.9)' },
};

/** Default visual list (the seed + the admin UI start from this). */
export const DEFAULT_ICON_CONFIG = FALLBACK;

/** Resolve using the admin's config first, then the built-in fallback. */
export function resolveVisual(type: string, config?: IconConfigMap): NotificationVisual {
    const entry = config?.[type] ?? FALLBACK[type] ?? { icon: 'bell', color: 'rgba(100,100,100,0.9)' };
    return { icon: renderIcon(entry.icon), background: entry.color };
}

/** Back-compat: fallback-only visual (no admin config). */
export function getNotificationVisual(type: string): NotificationVisual {
    return resolveVisual(type);
}

/** "5m ago" / "3h ago" / "2d ago" / falls back to a locale date string. */
export function timeAgo(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
