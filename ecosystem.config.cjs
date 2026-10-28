// ecosystem.config.cjs — PM2 process config for the blog (Windows-friendly).
//
// Why .cjs? package.json has "type": "module", so a plain .js file is treated
// as ESM and `module.exports` would fail. The .cjs extension forces CommonJS,
// which PM2 expects for its config.
//
// Why run server.js directly (not `npm start`)? On Windows PM2 cannot reliably
// daemonize `npm` (it's a .cmd batch file) — that's why `pm2 start npm -- start`
// showed status "stopped". Pointing straight at server.js fixes it.
//
// Usage:
//   pm2 delete blog            # remove the old broken entry
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 logs blog              # should show "Ready on http://localhost:3000"

module.exports = {
  apps: [
    {
      name: 'blog',
      script: 'server.js',
      // Serve the production build (server.js reads NODE_ENV; without this it
      // would fall back to dev mode and ignore the .next production output).
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      // Keep it alive; restart on crash, but back off if it crash-loops.
      autorestart: true,
      max_restarts: 10,
      // A production Next server can use a fair bit of memory; recycle if it
      // ever balloons past this (optional safety net).
      max_memory_restart: '600M',
    },
  ],
};
