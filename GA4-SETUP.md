# Google Analytics 4 (GA4) — Dashboard wiring

The admin **Visitors** chart and **Total Views** card now show REAL Google
Analytics data **when configured**. Until you set it up (and the site is live +
tracked + getting traffic), they automatically fall back to the built-in DB
analytics — so nothing breaks pre-launch.

## 1. Install the package (once)

```
npm install @google-analytics/data
```

(Already added to `package.json`.)

## 2. Google-side setup (once)

1. **Create a GA4 property** (analytics.google.com) and note the **Property ID**
   (Admin → Property Settings → *Property ID*, a number like `123456789`).
2. **Add the GA4 tag** to your PUBLIC site so it collects data. (We can add the
   tracking script to the blog layout when you're ready — tell me your
   Measurement ID `G-XXXXXXXX`.) **No tag = no data.**
3. In **Google Cloud Console**: enable the **Google Analytics Data API**.
4. Create a **Service Account** → create a **JSON key** → download it.
5. In GA4: **Admin → Property Access Management → add** the service-account email
   (`…@….iam.gserviceaccount.com`) as a **Viewer**.

## 3. Add to `.env` (server-only — never commit)

```
GA4_PROPERTY_ID=123456789
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

Notes:
- `GOOGLE_PRIVATE_KEY` is the `private_key` field from the JSON, **with the `\n`
  kept as literal `\n`** and the whole value in double quotes. The code restores
  the real newlines.
- Restart the dev server after editing `.env`.

## 4. What happens

- **Visitors chart** (`/api/admin/analytics/visitors`): if the 3 env vars are
  present → real `activeUsers` per day/week/month/12-months from GA4; else DB
  `post_views`. Response includes `"source": "ga4"` when GA4 is used.
- **Total Views card** (`/api/admin/dashboard-stats?metric=views`): GA4
  `screenPageViews` (all-time / selected range) when configured; else the DB view
  counter.
- Any GA4 error (not set up, no data yet, quota) → silent DB fallback. **No
  frontend changes were needed — the endpoints keep the same response shape.**

Files: `lib/analytics/ga4.ts` (helper), and the two endpoints above.
