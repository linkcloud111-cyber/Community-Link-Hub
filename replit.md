# LinkCloud

A premium public directory where users can discover and submit community invite links across WhatsApp, Telegram, Discord, Facebook Groups, Instagram Broadcast, X Communities, LinkedIn Groups, and YouTube Channels.

## Run & Operate

- `pnpm --filter @workspace/linkcloud run dev` — run the frontend (auto-managed by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (not used by this app)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui, framer-motion, next-themes
- Backend: Firebase Firestore (no SQL DB), Firebase Auth, Firebase Storage
- Routing: wouter
- Icons: lucide-react + react-icons/si
- Toasts: sonner

## Where things live

- `artifacts/linkcloud/` — main web app
- `artifacts/linkcloud/src/lib/firebase.ts` — Firebase app init (reads VITE_FIREBASE_* env vars)
- `artifacts/linkcloud/src/lib/firestore.ts` — all Firestore read/write helpers
- `artifacts/linkcloud/src/lib/auth.ts` — Firebase Auth helpers
- `artifacts/linkcloud/src/lib/types.ts` — shared TypeScript types
- `artifacts/linkcloud/src/contexts/AuthContext.tsx` — useAuth() hook + AuthProvider
- `artifacts/linkcloud/src/pages/` — all page components
- `artifacts/linkcloud/src/components/` — GroupCard, Navbar, Footer, ReportModal

## Firestore Collections

- `groups` — all submitted groups (status: pending/approved/rejected)
- `users` — user profiles with role (user/admin)
- `categories` — group categories
- `states` — state/province records
- `districts` — district records
- `reports` — user-submitted group reports

## Required Environment Secrets

All prefixed with `VITE_` so Vite exposes them to the browser:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## First Admin Setup

In Firestore, manually set `role: "admin"` on your user document in the `users` collection to gain admin access.

## Architecture decisions

- Firebase replaces the Express API server entirely for this app — all data ops are client-side via Firestore SDK
- Firestore queries use single `where("status", "==", ...)` filters only; all secondary filtering/sorting is done client-side to avoid requiring composite indexes
- Auth context provides `user`, `profile`, `loading`, and `isAdmin` to all components
- Platform icon for LinkedIn uses `Linkedin` from lucide-react (not react-icons/si which lacks it)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Firestore composite indexes: queries with multiple `where` + `orderBy` on different fields require manual index creation in Firebase Console. Current queries are designed to avoid this.
- LinkedIn icon: use `Linkedin` from `lucide-react`, NOT `SiLinkedin` from `react-icons/si` (doesn't exist in that package).
- Firebase env vars must be `VITE_` prefixed to be accessible in the Vite frontend.
- Clearing Vite cache (`rm -rf node_modules/.vite`) + workflow restart resolves most Firebase init errors caused by stale bundles.
