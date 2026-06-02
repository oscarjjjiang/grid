# GRID — project × time planner

A two-dimensional planner: projects/tasks on one axis, time on the other. Includes
a Gantt-style timeline with progress rollups and at-risk detection, an hourly Day
scheduler, an "On-Task" plant gauge, and a coin-jar XP/level system.

Built with React + Vite. It works two ways:

- **Local-only (default):** no setup, data is saved in your browser (`localStorage`).
  Great for one device. Does NOT sync to your phone, and is lost if you clear browser data.
- **Cloud sync (optional):** add free Supabase keys and your plans live in the cloud,
  tied to a passwordless email sign-in, so the same data loads on every device.

See **"Sync across devices"** below to turn on cloud mode.

---

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev        # http://localhost:5173
```

Build the production bundle (static files land in `dist/`):

```bash
npm run build
npm run preview    # serve the built dist/ locally to check it
```

---

## Deploy

Pick whichever matches how you answered. No environment variables, no server.

### Option A — Netlify (drag-and-drop, no Git needed)
1. `npm install && npm run build`
2. Go to https://app.netlify.com/drop
3. Drag the **`dist/`** folder onto the page. It's live in seconds.

(If you'd rather connect a repo, Netlify reads `netlify.toml` automatically:
build command `npm run build`, publish dir `dist`.)

### Option B — Vercel or Cloudflare Pages (via GitHub)
1. Push this folder to a GitHub repo:
   ```bash
   git init && git add . && git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<you>/grid-planner.git
   git push -u origin main
   ```
2. In Vercel (or Cloudflare Pages) → **Import / Add project** → select the repo.
3. The framework auto-detects as **Vite**:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy. Every future `git push` redeploys automatically.

### Option C — GitHub Pages
1. Open `vite.config.js` and set `base` to your repo name, e.g.
   ```js
   base: '/grid-planner/',
   ```
2. `npm run build`
3. Publish the `dist/` folder to a `gh-pages` branch. Easiest with the helper:
   ```bash
   npm install --save-dev gh-pages
   ```
   then add to `package.json` scripts:
   ```json
   "deploy": "npm run build && gh-pages -d dist"
   ```
   and run `npm run deploy`. Enable Pages on the `gh-pages` branch in repo settings.

---

## Sync across devices (cloud mode)

By default the app stores data only in the browser you're using. To check the same
plans on your laptop **and** phone, connect a free Supabase database. ~10 minutes, once.

### 1. Create a Supabase project
- Sign up at https://supabase.com (free, no card) → **New project**. Pick any name/password.
- Wait ~1 minute for it to provision.

### 2. Create the storage table
- In the project, open **SQL Editor → New query**.
- Paste the contents of `supabase-setup.sql` (in this folder) and click **Run**.
  This creates a `plans` table with row-level security so each user only sees their own data.

### 3. Allow email sign-in
- Go to **Authentication → Providers** and make sure **Email** is enabled (it is by default).
- Go to **Authentication → URL Configuration** and set **Site URL** to your deployed
  address (e.g. `https://your-app.vercel.app`). Add `http://localhost:5173` to
  **Redirect URLs** too if you want sign-in to work while developing locally.

### 4. Add your keys
- In Supabase: **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
- Copy `.env.example` to `.env.local` and paste them in:
  ```
  VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
  VITE_SUPABASE_ANON_KEY=your-anon-public-key
  ```
- For your **deployed** site, add those same two variables in your host's dashboard
  (Vercel/Netlify/Cloudflare → Project → Environment Variables), then redeploy.

### How it works
- Open the site → enter your email → you get a one-tap sign-in link (no password).
- Your whole planner is saved as one record tied to your account and synced on every edit
  (debounced). Sign in with the same email on another device to load it there.
- `localStorage` still acts as an offline cache, so the app opens instantly and keeps
  working without a connection; changes sync up when you're back online.
- The **anon public** key is safe to ship in a frontend — row-level security is what
  protects the data, and it only ever exposes a signed-in user's own row.

> Note: edits sync, but two devices editing the *same* plan at the *exact same time* use
> last-write-wins (no merge). For a personal single-user planner that's a non-issue.

---

- **Where your data lives.** In local-only mode it's in this browser under
  `grid.projects.v1` / `grid.tasks.v1` — clearing site data or switching devices starts
  fresh. In cloud mode (above) it lives in your Supabase account and follows you across
  devices. Either way there's a **reset** button (↺, top-right) to restore the sample data.
- **First load** shows sample projects so the UI isn't empty. Delete them and add
  your own — your changes persist from then on.
- The app fetches two fonts (Hanken Grotesk, JetBrains Mono) from Google Fonts at
  runtime. If you need a fully offline build, self-host them and replace the
  `@import` near the bottom of `src/Planner.jsx`.
- `React.StrictMode` (in `src/main.jsx`) double-invokes effects in **dev only** — this
  is expected and has no effect on the production build.
