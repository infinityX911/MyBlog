import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const getDbConfig = () => {
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      return {
        host: dbUrl.hostname || 'localhost',
        port: dbUrl.port ? parseInt(dbUrl.port, 10) : 3306,
        user: dbUrl.username || 'root',
        password: dbUrl.password || '',
        database: dbUrl.pathname.slice(1) || '',
      };
    } catch {}
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT) || 3306,
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || '',
  };
};

const adapter = new PrismaMariaDb(getDbConfig());
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding...');

  const testimonialCount = await prisma.testimonial.count();
  if (testimonialCount === 0) {
    console.log('  ↳ Seeding Testimonials...');
    await prisma.testimonial.createMany({
      data: [
        {
          name: 'Sarah J. Miller',
          reviews: "Working with this team was an absolute game-changer for our project. Not only was the communication seamless, but the final result actually exceeded our initial expectations. Their attention to detail and ability to meet tight deadlines without sacrificing quality is truly rare. I can't recommend them highly enough!",
          imageUrl: '/assets/img/people01.png',  // ← fixed
          jobTitles: 'Client',
        },
        {
          name: 'Marcus Thorne',
          reviews: "The level of creativity and strategic thinking this team brought to our rebranding was staggering. They didn't just give us a new look; they gave us a new identity that resonates perfectly with our target audience. If you want results that truly stand out, this is the team to hire.",
          imageUrl: '/assets/img/people02.png',  // ← fixed
          jobTitles: 'Client2',
        },
        {
          name: 'Dr. Elena Rodriguez',
          reviews: "Implementing their solution transformed our backend efficiency overnight. We saw a 40% reduction in latency and a significant improvement in user engagement. Their technical support is world-class, and they consistently deliver high-quality code on schedule. Truly a reliable partner for any scaling business.",
          imageUrl: '/assets/img/people03.png',  // ← fixed
          jobTitles: 'Client3',
        },
      ],
    });
  }

  const navbarCount = await prisma.navbar.count();
  if (navbarCount === 0) {
    console.log('  ↳ Seeding Navbar Links...');
    await prisma.navbar.createMany({
      data: [
        { title: 'Home', link: '#Home' },
        { title: 'Skills', link: '#Skills' },
        { title: 'Projects', link: '#Projects' },
        { title: 'Testimonials', link: '#Testimonials' },
        { title: 'Contact Us', link: '#ContactUs' },
      ],
    });
  }

  const headerExists = await prisma.header.findFirst({ where: { id: 1 } });
  if (!headerExists) {
    console.log('  ↳ Seeding Header Content...');
    await prisma.header.create({
      data: {
        id: 1,
        headings: "Hi! I'm Umair",
        description: "Full-Stack Developer with hands-on experience in Laravel and React.js,specializing in PHP, MySQL, REST APIs,and modern frontend development.XExperienced in building role-based web applications and admin dashboards",
        mainImage: 'images/1.svg',
        cv: 'cv/i06bb3RLh1rRnQD7aJtjOyuC51EtdXJYF61RBHbo.pdf',
      },
    });
  }

  console.log('  ↳ Processing System Permissions...');
  const permissionNames = [
    'Create Permissions', 'View Permissions', 'Update Permissions', 'Delete Permissions',
    'Create Roles', 'View Roles', 'Update Roles', 'Delete Roles',
    'Create Users', 'View Users', 'Update Users', 'Delete Users',
    'Create Projects', 'View Projects', 'Update Projects', 'Delete Projects',
    'Create Navbar', 'View Navbar', 'Update Navbar', 'Delete Navbar',
    'Create Header', 'View Header', 'Update Header', 'Delete Header',
    'Create Testimonials', 'View Testimonials', 'Update Testimonials', 'Delete Testimonials',
    'View ContactUs', 'Delete ContactUs',
    'View Comments', 'Manage Comments', 'Create Comment', 'Auto Approve Comments',
    'Upload Avatar',  // profile photo upload capability (revocable per user)
    'Use Messages',   // send/receive direct messages (revocable per user)
    'Manage Support', // accept & reply to visitor support chats

    // ── Added: blog post / category CRUD (the /api/posts module had no
    //    permission gate at all before this pass) ──────────────────────────
    'Create Posts', 'View Posts', 'Update Posts', 'Delete Posts',
    'Create Categories', 'View Categories', 'Update Categories', 'Delete Categories',

    // ── Added: admin-panel gate. Logging in is not enough to reach
    //    /admin/* anymore — the account must hold this permission too.
    //    Self-registered blog "Viewer" accounts (see seed below + the
    //    /api/auth/register route) get zero permissions by default, so
    //    they're excluded automatically. Grant this to any custom role
    //    (Manager, Editor, etc.) via the Roles admin page as needed. ──────
    'Access Admin Panel',

    // ── Added: controls whether a user's notification feed includes the
    //    site-wide/broadcast admin notifications (new comment, new
    //    registration, new contact message, etc.) in addition to their
    //    own. Without it, a user only ever sees notifications addressed
    //    directly to them (e.g. "X replied to your comment"). ────────────
    'View Admin Notifications',

    // ── Added (Phase 2): activity feed + account/status management. The
    //    goal is "every capability has a permission an admin can grant to
    //    anyone". recordEvent() writes an Activity row for every action;
    //    these gate who can READ that audit trail and who can change other
    //    people's account status. (Editing one's OWN profile never needs a
    //    permission — it's self-service.) ─────────────────────────────────
    'View Activities',          // see the global Recent Activities feed (all users)
    'Manage Activities',        // clear / delete activity log entries
    'Manage Notifications',     // create/broadcast or delete notifications
    'View User Status',         // see other users' approval status
    'Update User Status',       // change approved | pending | blocked on a user
    'Manage Downloads',         // CRUD on the downloads module
    'View Dashboard',           // see the admin dashboard analytics
    'Manage Settings',          // edit global site/SEO settings
    'Delete Comments',          // moderation: delete ANY user's comment (owners can always delete their own)
    'Use Contact Form',         // send messages via the public /contact form (remove from a role to block it)

    // ── Added (RBAC pass): view permissions for the admin tabs that had no
    //    gate, so EVERY sidebar tab is permission-gated (hidden + blocked).
    //    Administrator gets them (below); other roles get nothing new. ───────
    'View Pages',               // blog CMS pages tab
    'View YouTube Channels',    // blog → youtube channels tab
    'Manage Footer',            // blog/portfolio footer editor
    'Manage YT Downloader',     // yt-downloader pages/analytics tab
    'View Orders',              // orders tab
    'View Messages',            // admin messages tab
    'View Notifications',       // admin notifications tab
    // ── Community features ──────────────────────────────────────────────────
    'View Members',             // public members directory (/members)
    'Manage Announcements',     // create/delete announcements (admin)
    'Oversee Messages',         // read-only oversight of all conversations (admin)

    // ── Media library (Management → Media) ──────────────────────────────────
    //    Browsing every uploaded file is a different privilege from adding
    //    one, and deleting is different again — a file can be referenced by a
    //    live post, so removal is destructive and deserves its own grant.
    'View Media',               // open the library and list uploaded files
    'Upload Media',             // add new files
    'Delete Media',             // permanently remove files from disk

    // ── YouTube downloader (the public-facing tool at /yt) ──────────────────
    //    Distinct from 'Manage YT Downloader', which is the ADMIN tab (pages,
    //    analytics, cookie settings). This one grants use of the tool itself.
    //    NOTE: the slug is derived from this name (lowercase, dashes), and
    //    lib/yt/allowlist.ts checks that slug literally — so renaming this
    //    string without updating YT_PERMISSION there creates a second, unused
    //    permission and silently locks everyone out. Keep the two in step.
    //    Deliberately granted to nobody by default: the tool spends real CPU
    //    and bandwidth, and should stay invisible until handed out on purpose.
    'Use Downloader Tool',      // → slug: use-downloader-tool
  ];

  const savedPermissions = [];
  for (const name of permissionNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let perm = await prisma.permission.findFirst({ where: { slug } });
    if (!perm) {
      perm = await prisma.permission.create({ data: { name, slug } });
    }
    savedPermissions.push(perm);
  }

  console.log('  ↳ Processing System Roles...');
  const systemRoles = [
    { name: 'Administrator', slug: 'administrator' },
    { name: 'Manager', slug: 'manager' },
    { name: 'Editor', slug: 'editor' },
    { name: 'Viewer', slug: 'viewer' },
    { name: 'Guest', slug: 'guest' },
  ];

  let adminRoleRecord;
  for (const role of systemRoles) {
    let r = await prisma.role.findFirst({ where: { slug: role.slug } });
    if (!r) {
      r = await prisma.role.create({ data: { name: role.name, slug: role.slug } });
    }
    if (role.slug === 'administrator') adminRoleRecord = r;
  }

  console.log('  ↳ Processing User Accounts...');
  const hashedPassword = bcrypt.hashSync('123', 10);

  let umairUser = await prisma.user.findUnique({ where: { email: 'umairali2562@gmail.com' } });
  if (!umairUser) {
    umairUser = await prisma.user.create({
      data: { name: 'Umair', email: 'umairali2562@gmail.com', password: hashedPassword, status: 'approved', emailVerified: true },
    });
  } else {
    // Make sure the primary admin is always approved + verified.
    umairUser = await prisma.user.update({ where: { id: umairUser.id }, data: { status: 'approved', emailVerified: true } });
  }

  // Existing users are treated as already email-verified so the new
  // verification requirement doesn't lock anyone out. New signups start
  // unverified and must confirm via the emailed link.
  await prisma.user.updateMany({ data: { emailVerified: true } });

  let waqarUser = await prisma.user.findUnique({ where: { email: 'Waqar@gmail.com' } });
  if (!waqarUser) {
    await prisma.user.create({
      data: { name: 'Waqar', email: 'Waqar@gmail.com', password: hashedPassword },
    });
  }

  if (umairUser && adminRoleRecord) {
    console.log('  ↳ Synchronizing Admin Role & Permissions...');
    // Effective access = assigned (direct) permissions, so the admin gets ALL
    // permissions assigned directly. The Administrator role also gets them as
    // its pool (below) so the edit page shows every checkbox checked.
    for (const perm of savedPermissions) {
      const directExists = await prisma.userPermission.findUnique({
        where: { userId_permissionId: { userId: umairUser.id, permissionId: perm.id } },
      });
      if (!directExists) {
        await prisma.userPermission.create({ data: { userId: umairUser.id, permissionId: perm.id } });
      }
    }
    for (const perm of savedPermissions) {
      const exists = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: adminRoleRecord.id, permissionId: perm.id } },
      });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: adminRoleRecord.id, permissionId: perm.id } });
      }
    }
    const userRoleExists = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: umairUser.id, roleId: adminRoleRecord.id } },
    });
    if (!userRoleExists) {
      await prisma.userRole.create({ data: { userId: umairUser.id, roleId: adminRoleRecord.id } });
    }
  }

  // ── Commenting is a ROLE permission ───────────────────────────────────────
  // Assign "create-comment" to every role EXCEPT Guest (so "Guest" acts as a
  // built-in mute role), then make sure every user has at least the default
  // "Viewer" role so they can comment by default.
  console.log('  ↳ Assigning comment permission to roles...');
  const createCommentPerm = await prisma.permission.findFirst({ where: { slug: 'create-comment' } });
  const allRoles = await prisma.role.findMany();
  if (createCommentPerm) {
    for (const role of allRoles) {
      if (role.slug === 'guest') continue; // Guest cannot comment
      const exists = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: createCommentPerm.id } },
      });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: createCommentPerm.id } });
      }
    }
  }

  // Profile-photo upload is a default capability for every non-guest role.
  const uploadAvatarPerm = await prisma.permission.findFirst({ where: { slug: 'upload-avatar' } });
  if (uploadAvatarPerm) {
    for (const role of allRoles) {
      if (role.slug === 'guest') continue;
      const exists = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: uploadAvatarPerm.id } },
      });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: uploadAvatarPerm.id } });
      }
    }
  }

  // Messaging is a default capability for every non-guest role (revocable
  // per-user from the Users edit page, like upload-avatar / create-comment).
  const useMessagesPerm = await prisma.permission.findFirst({ where: { slug: 'use-messages' } });
  if (useMessagesPerm) {
    for (const role of allRoles) {
      if (role.slug === 'guest') continue;
      const exists = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: useMessagesPerm.id } },
      });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: useMessagesPerm.id } });
      }
    }
  }

  // Support handling: staff roles can accept & reply to visitor support chats.
  const manageSupportPerm = await prisma.permission.findFirst({ where: { slug: 'manage-support' } });
  if (manageSupportPerm) {
    for (const role of allRoles) {
      if (!['administrator', 'manager', 'editor'].includes(role.slug)) continue;
      const exists = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: manageSupportPerm.id } },
      });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: manageSupportPerm.id } });
      }
    }
  }

  // Auto-approve: staff roles (Administrator/Manager/Editor) auto-approve their
  // comments; Viewer comments stay moderated (pending) until an admin approves.
  const autoApprovePerm = await prisma.permission.findFirst({ where: { slug: 'auto-approve-comments' } });
  if (autoApprovePerm) {
    for (const role of allRoles) {
      if (!['administrator', 'manager', 'editor'].includes(role.slug)) continue;
      const exists = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: autoApprovePerm.id } },
      });
      if (!exists) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: autoApprovePerm.id } });
      }
    }
  }
  // Every user gets at least the Viewer role by default.
  const viewerRoleRecord = allRoles.find(r => r.slug === 'viewer');
  if (viewerRoleRecord) {
    const usersWithoutRole = await prisma.user.findMany({ where: { roles: { none: {} } }, select: { id: true } });
    for (const u of usersWithoutRole) {
      await prisma.userRole.create({ data: { userId: u.id, roleId: viewerRoleRecord.id } });
    }
  }

  // Default: assign "create-comment" DIRECTLY to every user so they can comment
  // out of the box (access = assigned perms). Admin can revoke per-user by
  // unchecking it on the Users edit page, or for everyone by removing it from
  // the role (which cascades to its users).
  const defaultUserPerms = [createCommentPerm, uploadAvatarPerm, useMessagesPerm].filter(Boolean) as { id: number }[];
  if (defaultUserPerms.length) {
    const everyUser = await prisma.user.findMany({ select: { id: true } });
    for (const u of everyUser) {
      for (const perm of defaultUserPerms) {
        const exists = await prisma.userPermission.findUnique({
          where: { userId_permissionId: { userId: u.id, permissionId: perm.id } },
        });
        if (!exists) {
          await prisma.userPermission.create({ data: { userId: u.id, permissionId: perm.id } });
        }
      }
    }
  }

  // ── Notification icon defaults ───────────────────────────────────────────
  console.log('  ↳ Seeding Notification Icons...');
  const notificationIconDefaults = [
    { typeKey: 'comment',          label: 'New comment',        icon: 'message',  color: 'rgba(43, 119, 229, 0.9)' },
    { typeKey: 'comment_reply',    label: 'Comment reply',      icon: 'reply',    color: 'rgba(8, 88, 247, 0.9)' },
    { typeKey: 'contact',          label: 'Contact message',    icon: 'mail',     color: 'rgba(26, 159, 83, 0.9)' },
    { typeKey: 'user.register',    label: 'New registration',   icon: 'userPlus', color: 'rgba(190, 14, 225, 0.9)' },
    { typeKey: 'user.update',      label: 'User updated',       icon: 'userCheck',color: 'rgba(13, 148, 136, 0.9)' },
    { typeKey: 'user.status',      label: 'User status changed',icon: 'shield',   color: 'rgba(202, 138, 4, 0.9)' },
    { typeKey: 'auth.login',       label: 'User logged in',     icon: 'login',    color: 'rgba(26, 159, 83, 0.9)' },
    { typeKey: 'profile.update',   label: 'Profile updated',    icon: 'pencil',   color: 'rgba(8, 88, 247, 0.9)' },
    { typeKey: 'profile.password', label: 'Password changed',   icon: 'shield',   color: 'rgba(220, 38, 38, 0.9)' },
    { typeKey: 'post.create',      label: 'Post created',       icon: 'file',     color: 'rgba(234, 88, 12, 0.9)' },
    { typeKey: 'post.update',      label: 'Post updated',       icon: 'pencil',   color: 'rgba(234, 88, 12, 0.9)' },
    { typeKey: 'post.delete',      label: 'Post deleted',       icon: 'trash',    color: 'rgba(220, 38, 38, 0.9)' },
  ];
  for (const ni of notificationIconDefaults) {
    const exists = await prisma.notificationIcon.findUnique({ where: { typeKey: ni.typeKey } });
    if (!exists) await prisma.notificationIcon.create({ data: ni });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => { console.error('❌ Seeding failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
