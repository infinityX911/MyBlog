// server.js
// Custom Next.js server with an attached Socket.io server, so we get
// real-time notifications without needing a separate process.
//
// Why a custom server: Next.js's built-in dev/start servers don't expose
// a persistent HTTP server we can attach WebSocket listeners to. This
// file creates the HTTP server ourselves, hands page requests to Next.js,
// and attaches Socket.io on the same port — so in production behind
// Nginx, only ONE upstream port needs WebSocket-upgrade headers forwarded.
//
// Production note (Nginx + subdomain + HTTPS):
//   - Nginx must forward the `Upgrade` and `Connection: upgrade` headers
//     on the proxied location block, e.g.:
//       proxy_http_version 1.1;
//       proxy_set_header Upgrade $http_upgrade;
//       proxy_set_header Connection "upgrade";
//   - Socket.io automatically uses wss:// when the page is served over
//     https://, so no extra client config is needed once SSL is live.
//   - If the admin panel ever moves to its own subdomain, update the
//     Socket.io CORS `origin` below to include that subdomain explicitly.

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { decode } from 'next-auth/jwt';
import mysql from 'mysql2/promise';
import { startScheduledPublisher } from './scheduler.js';

const dev = process.env.NODE_ENV !== 'production';

// ── Socket auth helpers ──────────────────────────────────────────────────────
// Verify the next-auth session JWT from the handshake cookie so a socket can't
// just claim to be any user / an admin. Anonymous sockets are still allowed to
// connect (needed for the public support chat) but cannot join admin or
// other users' private rooms.
function parseCookies(cookieHeader) {
    const out = {};
    if (!cookieHeader) return out;
    for (const part of cookieHeader.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    return out;
}

async function getSocketUser(socket) {
    try {
        const cookies = parseCookies(socket.request?.headers?.cookie);
        const raw =
            cookies['__Secure-next-auth.session-token'] ||
            cookies['next-auth.session-token'];
        if (!raw) return null;
        const token = await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET });
        return token; // { id, roles, permissions, ... } or null
    } catch {
        return null;
    }
}

// Small read-only pool (separate from Prisma) so the socket layer can verify
// conversation ownership before letting a client into a support-chat room.
const socketDbPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'api',
    connectionLimit: 5,
    waitForConnections: true,
});

// May this socket join `conversation:<id>`?
//   - support staff (manage-support / view-admin-notifications / admin) → any chat
//   - the registered participant of that conversation
//   - the anonymous visitor whose guestId matches the conversation row
async function canJoinConversation({ conversationId, authUserId, guestId, canSupport }) {
    const id = Number(conversationId);
    if (!id) return false;
    if (canSupport) return true;
    try {
        const [rows] = await socketDbPool.query(
            `SELECT c.id FROM conversations c
               LEFT JOIN conversation_participants p
                 ON p.conversation_id = c.id AND p.user_id = ?
              WHERE c.id = ? AND (c.guest_id = ? OR p.user_id IS NOT NULL)
              LIMIT 1`,
            [authUserId ?? 0, id, guestId ?? '']
        );
        return Array.isArray(rows) && rows.length > 0;
    } catch (e) {
        console.error('[socket canJoinConversation]', e);
        return false; // fail closed
    }
}

const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true);
        handle(req, res, parsedUrl);
    });

    const io = new SocketIOServer(httpServer, {
        path: '/api/socket',
        cors: {
            // Same-origin in dev and in a single-domain production setup.
            // Add explicit subdomains here if the admin panel ever splits off.
            origin: dev ? '*' : false,
        },
    });

    // ── Presence (online/offline) ───────────────────────────────────────────
    // Count live socket connections per user (a user can have several tabs).
    // We only broadcast on the 0↔1 transition so the UI flips once per user.
    const online = new Map(); // userId -> connection count
    function setOnline(userId, delta) {
        const id = Number(userId);
        if (!id) return;
        const before = online.get(id) || 0;
        const after = before + delta;
        if (after <= 0) online.delete(id);
        else online.set(id, after);
        const isOnline = (online.get(id) || 0) > 0;
        if ((before === 0 && isOnline) || (before > 0 && !isOnline)) {
            io.emit('presence-change', { userId: id, online: isOnline });
        }
    }
    // Expose for API routes that want to read presence synchronously.
    globalThis.__onlineUsers = online;

    // Admins join a shared "admins" room so we can broadcast notifications
    // to every logged-in admin without tracking individual socket IDs.
    io.on('connection', async (socket) => {
        let presenceUserId = null; // the user this socket counts toward

        // Identify the socket from its verified session JWT (or null if anon).
        const authUser = await getSocketUser(socket);
        const authUserId = authUser?.id ? Number(authUser.id) : null;
        const perms = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
        const isAdmin = perms.includes('access-admin-panel');
        const canSupport =
            isAdmin || perms.includes('manage-support') || perms.includes('view-admin-notifications');

        socket.on('join-admin-room', () => {
            // Only real admins may receive the admin notification broadcast.
            if (isAdmin) socket.join('admins');
        });

        // Per-user room for direct messaging. The client passes a userId, but we
        // IGNORE it for trust and bind the socket to its OWN authenticated id —
        // so a socket can never subscribe to another user's private room.
        socket.on('join-user', () => {
            if (!authUserId) return; // anonymous → no private room
            socket.join(`user:${authUserId}`);
            // Count this socket toward presence exactly once.
            if (presenceUserId === null) {
                presenceUserId = authUserId;
                setOnline(presenceUserId, +1);
                // Send the current online list to the freshly-joined socket.
                socket.emit('presence-snapshot', Array.from(online.keys()));
            }
        });

        // Support-chat room. Previously ANY socket could join conversation:<id>
        // (sequential ids) and eavesdrop on others' support chats. Now we verify
        // ownership: support staff → any chat; otherwise the registered
        // participant, or the anonymous visitor whose guestId matches.
        // payload: number/string (admin inbox) OR { conversationId, guestId } (visitor)
        socket.on('join-conversation', async (payload) => {
            const conversationId = payload && typeof payload === 'object' ? payload.conversationId : payload;
            const guestId = payload && typeof payload === 'object' ? payload.guestId : null;
            if (!conversationId) return;
            const ok = await canJoinConversation({ conversationId, authUserId, guestId, canSupport });
            if (ok) socket.join(`conversation:${conversationId}`);
        });

        // Public per-target comment feed. Approved comments on published
        // posts/downloads/CMS pages are public, so ANY socket may subscribe to
        // `comments:<type>:<id>` to receive live updates when a new approved
        // comment (or a freshly-approved one) lands.
        socket.on('join-comments', (room) => {
            if (typeof room === 'string' && /^comments:(post|download|cmsPage):\d+$/.test(room)) {
                socket.join(room);
            }
        });

        socket.on('disconnect', () => {
            if (presenceUserId !== null) setOnline(presenceUserId, -1);
        });
    });

    // Expose the io instance globally so API routes (which run in the
    // same Node process under this custom server) can emit events.
    globalThis.__io = io;

    // Scheduled publishing: flips due posts / pages / downloads to "published"
    // on a timer. Lives here because this is the one long-running process we
    // control — no crontab or extra service needed on the VPS.
    startScheduledPublisher();

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Socket.io listening on path /api/socket`);
    });
});
