# Markly — Smart Bookmark Manager

A minimal, real-time bookmark manager built with Next.js, Supabase, and Tailwind CSS.

**Live URL:** https://bookmark-1bco7oald-vamsys-projects-ca56c14f.vercel.app

---

## Features

- Google OAuth login (no email/password)
- Add and delete bookmarks (URL + title)
- Bookmarks are private per user — no user can see another user's bookmarks
- Real-time updates across browsers and devices without page refresh
- Favicon detection for saved URLs
- Relative timestamps ("Just now", "2h ago", etc.)

---

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Auth + Database + Realtime:** Supabase
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

---

## Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 3. Run the database setup SQL

In your Supabase SQL Editor, run the contents of `supabase-setup.sql`. This creates the `bookmarks` table, enables RLS policies, adds the table to the Realtime publication, and sets `REPLICA IDENTITY FULL` for DELETE events.

### 4. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`
4. Copy the Client ID and Secret into Supabase → Authentication → Providers → Google

### 5. Set environment variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 6. Run locally

```bash
npm run dev
```

---

## Problems Encountered and Solutions

### 1. Supabase Realtime WebSocket failing on localhost (`CLOSED` → `TIMED_OUT`)

**Problem:** The Supabase Realtime WebSocket connection consistently failed on `localhost` with `WebSocket is closed before the connection is established`, then timed out. This happened despite the Supabase project being active, the `bookmarks` table being correctly added to the `supabase_realtime` publication, and Node.js v22 being installed. Testing the raw WebSocket URL directly in the browser console confirmed the connection worked fine — the issue was specific to how Next.js dev server handles WebSocket upgrades internally, which interfered with Supabase's WebSocket handshake.

**Solution:** Deployed to Vercel. Realtime works correctly in production. The local dev issue is a known incompatibility between Next.js's Webpack dev server and Supabase's WebSocket initialization. As a fallback for same-browser cross-tab sync, the `BroadcastChannel` API was implemented alongside Supabase Realtime.

---

### 2. Realtime DELETE events not propagating cross-browser

**Problem:** After fixing Realtime for INSERT events, DELETE events were not being received in other browsers. The `payload.old` object was empty, so `payload.old.id` was `undefined` and the bookmark could not be removed from the other browser's state.

**Solution:** By default, Postgres only includes the primary key in the WAL log for DELETE operations. Running the following SQL fixes this by telling Postgres to log the full row on DELETE:

```sql
ALTER TABLE bookmarks REPLICA IDENTITY FULL;
```

---

### 3. Supabase client recreated on every render

**Problem:** The Supabase client was initialized inside the React component body (`const supabase = createClient()`), which meant a new client instance — and a new WebSocket connection — was created on every render. This caused connection instability and potential memory leaks.

**Solution:** Moved the client instantiation outside the component so a single stable instance is used for the lifetime of the page.

---

### 4. Missing server-side Realtime filter

**Problem:** The original Realtime subscription had no server-side filter, relying on a client-side check (`if (newBookmark.user_id !== user.id) return`) to discard events from other users. This meant Supabase was sending all bookmark events to all subscribers, with filtering happening after delivery.

**Solution:** Added a `filter` parameter to the Realtime subscription so Supabase only delivers events for the authenticated user's rows:

```typescript
filter: `user_id=eq.${user.id}`;
```

---

### 5. Google OAuth redirect failing after Vercel deployment

**Problem:** After deploying to Vercel, clicking "Continue with Google" redirected back to `localhost` instead of the Vercel URL, causing the OAuth flow to fail.

**Solution:** Added the Vercel deployment URL to:

- Supabase → Authentication → URL Configuration → Redirect URLs
- Google Cloud Console → OAuth client → Authorized redirect URIs
