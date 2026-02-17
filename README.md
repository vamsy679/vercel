# Markly — Smart Bookmark Manager

A real-time bookmark manager built with Next.js (App Router), Supabase, and Tailwind CSS. Users sign in with Google OAuth and can add, view, and delete private bookmarks that sync in real-time across tabs.

## Features

- **Google OAuth** — Sign up and log in via Google (no email/password)
- **Add bookmarks** — Save any URL with a title
- **Private bookmarks** — Each user only sees their own bookmarks (enforced via Supabase RLS)
- **Real-time sync** — Bookmarks update instantly across tabs via Supabase Realtime
- **Delete bookmarks** — Remove bookmarks with a single click
- **Responsive design** — Works on mobile and desktop

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (Auth, PostgreSQL Database, Realtime)
- **Tailwind CSS**
- **TypeScript**

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Go to **SQL Editor** and run the contents of `supabase-setup.sql` to create the bookmarks table, RLS policies, and enable realtime.

### 2. Configure Google OAuth

1. In your Supabase dashboard, go to **Authentication → Providers → Google**.
2. Enable Google provider.
3. Create OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create an OAuth 2.0 Client ID (Web application)
   - Add your Supabase callback URL as an authorized redirect URI:  
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - For local development, also add: `http://localhost:3000/auth/callback`
4. Copy the Client ID and Client Secret into Supabase's Google provider settings.

### 3. Set Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

You can find these in **Supabase → Settings → API**.

### 4. Install & Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push the repo to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Add the environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Vercel's project settings.
4. Deploy.
5. **Important**: After deploying, add your Vercel URL to Google OAuth's authorized redirect URIs and to Supabase's **Authentication → URL Configuration → Redirect URLs** (e.g. `https://your-app.vercel.app/auth/callback`).

## Problems Encountered & Solutions

### 1. Session Handling with App Router
**Problem**: Supabase auth sessions need to be refreshed on every server request in Next.js App Router, but there's no built-in mechanism for this.  
**Solution**: Implemented Next.js middleware (`middleware.ts`) using `@supabase/ssr` that intercepts every request and refreshes the session by calling `supabase.auth.getUser()`. This ensures the auth cookie stays valid.

### 2. Realtime Updates with RLS
**Problem**: Supabase Realtime requires the table to be added to `supabase_realtime` publication, and RLS policies must allow the subscription.  
**Solution**: Added `ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;` in the SQL setup, and ensured the SELECT RLS policy covers the authenticated user so realtime events are properly filtered.

### 3. Duplicate Entries on Realtime INSERT
**Problem**: When adding a bookmark, the optimistic local state update and the realtime INSERT event could cause duplicate entries in the UI.  
**Solution**: Added a deduplication check in the realtime handler: `if (prev.find(b => b.id === payload.new.id)) return prev;` — this ensures each bookmark only appears once regardless of timing.

### 4. OAuth Redirect URL Configuration
**Problem**: Google OAuth requires exact redirect URIs, and the callback chain goes through Supabase before returning to the app.  
**Solution**: Configured the callback route at `/auth/callback` to exchange the authorization code for a session using `supabase.auth.exchangeCodeForSession(code)`, and ensured both Supabase and Google Cloud Console have all redirect URLs registered (localhost for dev, Vercel URL for production).

## Project Structure

```
├── app/
│   ├── auth/callback/route.ts   # OAuth callback handler
│   ├── login/page.tsx            # Login page with Google OAuth
│   ├── page.tsx                  # Main page (redirects if not authed)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Tailwind + custom styles
├── components/
│   └── BookmarkList.tsx          # Main bookmark UI with realtime
├── lib/
│   ├── supabase-browser.ts      # Browser Supabase client
│   └── supabase-server.ts       # Server Supabase client
├── middleware.ts                 # Session refresh middleware
├── supabase-setup.sql           # Database setup script
└── .env.local.example           # Environment variables template
```
