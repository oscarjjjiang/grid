# Deploying GRID with Supabase — a step-by-step guide

This walks you through putting your planner online so you can open it on your laptop
**and** your phone and see the same plans. Every step says **what you're doing** and
**why it matters**, so you're not just copy-pasting blindly.

Total time: about 20–30 minutes, done once.

---

## The big picture (read this first)

Your app is made of two separate things:

1. **The website (the "front end").** This is the planner interface — the timeline,
   the day view, the plant gauge. It's a *static site*: a bundle of HTML/CSS/JavaScript
   files that a host (Vercel, Netlify, etc.) serves to anyone who visits. There's no
   server of yours running here. This is what makes hosting free and maintenance-free.

2. **The database (the "back end").** Static files can't store data that survives across
   devices on their own. So the JavaScript in your browser talks over the internet to
   **Supabase**, a service that gives you a real database plus a login system. Your plans
   live there, tied to your account.

> **Why two pieces?** Keeping the website static (cheap, simple, fast) while pushing the
> "remembering" job to Supabase is the standard modern setup. Your site never needs a
> server you babysit; Supabase handles the data part for you.

The flow you're building:

```
  Your laptop browser ──┐
                        ├──► Supabase (database + login) ◄── stores your plans
  Your phone browser  ──┘
```

You'll set things up in this order: **run it locally → create the database → connect
them → put it online**.

---

## Prerequisites

| What | Why you need it | Where |
|------|-----------------|-------|
| **Node.js 18+** | The tool that installs the app's code libraries and builds the website files. | https://nodejs.org (get the "LTS" version) |
| **A terminal** | To run a few commands. macOS: "Terminal" app. Windows: "PowerShell". | Built into your OS |
| **A GitHub account** | Stores your code so the host can deploy it (and re-deploy when you change things). | https://github.com (free) |
| **A Supabase account** | The database + login. | https://supabase.com (free, no card) |
| **The project zip** | The planner's source code (`grid-planner.zip`). | Already downloaded |

Check Node is installed by running this in your terminal:

```bash
node -v
```

If it prints a version like `v20.x`, you're good. If it errors, install Node first.

---

## Part A — Run the app on your own computer

Doing this first confirms the app works *before* you add the cloud, so if something
breaks later you know it's the Supabase part, not the app.

**1. Unzip the project and open it in the terminal.**

```bash
cd path/to/grid-planner      # the folder you unzipped
```

**2. Install the app's dependencies.**

```bash
npm install
```

> **What this does:** downloads the code libraries the app relies on (React, the
> Supabase client, etc.) into a `node_modules` folder. You only do this once per machine.
> It does **not** touch the internet again after that.

**3. Start it locally.**

```bash
npm run dev
```

> **What this does:** runs a temporary local web server (only on your computer) so you can
> preview the app. It prints an address like `http://localhost:5173`. Open that in your
> browser — you should see the planner. At this stage it's in **local-only mode**: data
> saves to that one browser, no login, no sync. That's expected; we add the cloud next.
> Press `Ctrl+C` in the terminal to stop it.

---

## Part B — Create your Supabase database

This is the part that lets data follow you between devices.

**4. Create a Supabase project.**

- Go to https://supabase.com, sign up, and click **New project**.
- Give it any name, set a database password (save it somewhere — you won't need it often),
  pick the region closest to you, and create it.
- Wait ~1–2 minutes while it provisions.

> **What a "project" is:** your own private database instance plus the login/auth system,
> all bundled. One project is plenty for this app.

**5. Create the table that holds your plans.**

- In your project, open **SQL Editor** (left sidebar) → **New query**.
- Open the file `supabase-setup.sql` from the project folder, copy everything, paste it
  into the query box, and click **Run**.

> **What this does:** it creates a table called `plans` with three columns — `user_id`
> (which account the row belongs to), `data` (your entire planner stored as JSON), and
> `updated_at` (a timestamp). It then turns on **Row-Level Security (RLS)** and adds a
> rule that says *"a logged-in user can only read or write the row whose `user_id` matches
> their own."*
>
> **Why RLS matters:** without it, anyone could potentially read everyone's data. With it,
> the database itself enforces that your plans are visible only to you — even though the
> app's access key is public (more on that in step 8). This is the single most important
> security step, which is why it's baked into the SQL.

**6. Make sure email sign-in is on.**

- Go to **Authentication → Providers** (sometimes under "Sign In / Up").
- Confirm **Email** is enabled. It is by default.

> **What this enables:** the "magic link" login. Instead of a password, you type your
> email, Supabase emails you a one-time link, and clicking it signs you in. Fewer things
> to forget, and it works the same on any device.

**7. Tell Supabase which web addresses are allowed.**

- Go to **Authentication → URL Configuration**.
- Set **Site URL** to where the app will live. For now you can use
  `http://localhost:5173`; you'll change it to your real address after deploying (step 13).
- Under **Redirect URLs**, add `http://localhost:5173` too (and later your live URL).

> **Why this exists:** the magic-link email sends you *back* to your app after you click
> it. Supabase only allows redirects to addresses you've approved here — a safety measure
> so a stolen link can't bounce you to a malicious site. If this list doesn't include your
> app's address, sign-in will fail with a "redirect not allowed" error.

**8. Copy your project's API keys.**

- Go to **Project Settings → API**.
- Copy two values:
  - **Project URL** — looks like `https://abcdxyz.supabase.co`
  - **anon / public key** — a long string labeled "anon" and "public"

> **Is it safe to put the anon key in a public website?** Yes. The anon key is *designed*
> to ship in front-end code — it only lets the app attempt actions, and the Row-Level
> Security rule from step 5 is what actually decides what each signed-in user can touch.
> **Do NOT** use the `service_role` key in the app — that one bypasses security and must
> stay secret. You only ever need the **anon** key here.

---

## Part C — Connect the app to your database (locally)

**9. Add your keys to a local environment file.**

- In the project folder, find `.env.example`. Make a copy named exactly `.env.local`.
- Open `.env.local` and paste in your two values:

```
VITE_SUPABASE_URL=https://abcdxyz.supabase.co
VITE_SUPABASE_ANON_KEY=your-long-anon-key
```

> **What an environment file is:** a place to store configuration (like keys) *outside*
> the code, so secrets and settings aren't hard-baked into files you might share. The app
> reads these at build time. The `VITE_` prefix is required — the build tool (Vite) only
> exposes variables that start with `VITE_` to the browser code, as a safety default.
>
> **Note:** `.env.local` is git-ignored, so it won't get uploaded to GitHub. That's fine —
> you'll re-enter these keys in your host's dashboard in step 12.

**10. Run it again and test the login.**

```bash
npm run dev
```

Open `http://localhost:5173`. This time you should see a **sign-in screen**. Enter your
email, check your inbox for the link, and click it. You should land back in the app,
signed in, with your plans now syncing to Supabase.

> **What just happened:** because the keys are present, the app switched from local-only
> mode to **cloud mode**. Every edit now saves to your Supabase `plans` table (after a
> short pause), and loads from there when you sign in.

---

## Part D — Put it on the internet

Local works; now make it reachable from anywhere. We'll use **Vercel** (free, and it
auto-redeploys whenever you change the code). Netlify and Cloudflare Pages work almost
identically.

**11. Push the project to GitHub.**

In the project folder:

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/grid-planner.git
git push -u origin main
```

(Create an empty repo named `grid-planner` on github.com first to get that URL.)

> **Why GitHub:** Vercel deploys *from* a GitHub repository. Putting your code there gives
> Vercel something to pull from, and means every future change you push is automatically
> rebuilt and re-deployed — no manual uploading. Your `.env.local` is **not** pushed
> (it's git-ignored), which is correct; keys go in Vercel directly next.

**12. Import the repo into Vercel and add your keys.**

- Go to https://vercel.com, sign in with GitHub, click **Add New → Project**, and pick
  your `grid-planner` repo.
- Vercel auto-detects it as a **Vite** app (build command `npm run build`, output `dist`).
  Leave those as detected.
- Before deploying, open **Environment Variables** and add the same two from `.env.local`:
  - `VITE_SUPABASE_URL` = your project URL
  - `VITE_SUPABASE_ANON_KEY` = your anon key
- Click **Deploy**.

> **Why re-enter the keys here:** the host builds the site on *its* machines, not yours,
> so it can't see your local `.env.local`. The build needs the keys to bake cloud mode in.
> If you skip this, the deployed site silently falls back to local-only mode (no login).

> **What you get:** after ~1 minute, a live URL like `https://grid-planner-xxxx.vercel.app`.
> That's your planner, on the internet.

**13. Close the loop: tell Supabase your real address.**

- Copy your new Vercel URL.
- Back in Supabase → **Authentication → URL Configuration**, set **Site URL** to that URL
  and add it to **Redirect URLs**.

> **Why this final step:** the magic-link email needs to send you back to your *live* site,
> not localhost. Until you add the real URL here, clicking the email link from your phone
> would fail. This is the most common reason "it worked locally but not after deploying."

---

## Part E — Daily use

- Open your Vercel URL on any device → enter your email → tap the link it sends.
- Edit your plans. Changes save to Supabase automatically (about a second after you stop).
- Open the same URL on another device, sign in with the **same email**, and your plans are
  there.
- `localStorage` still keeps a local copy, so the app opens instantly and keeps working if
  your connection drops; changes sync up when you're back online.

**To make future changes to the app:** edit the code, then `git push`. Vercel rebuilds and
redeploys on its own within a minute.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Deployed site shows no login screen | Keys not set on the host | Add both `VITE_` variables in Vercel → Environment Variables, then redeploy |
| "redirect not allowed" after clicking the email link | Your live URL isn't approved | Add it under Supabase → Authentication → URL Configuration (Site URL + Redirect URLs) |
| Magic-link email never arrives | Spam folder, or Supabase's built-in email rate limit hit | Check spam; wait a few minutes; for heavy use configure custom SMTP in Supabase |
| Signed in but plans don't save/sync | The SQL step didn't run, or RLS policy missing | Re-run `supabase-setup.sql` in the SQL Editor |
| Changing keys had no effect on the live site | Env vars are read at **build** time | After changing keys in Vercel, trigger a redeploy |
| Works on laptop, empty on phone | Signed in with a different email | Use the exact same email address on both devices |

---

## Good to know

- **Cost:** Supabase's free tier (500 MB database, plenty of auth users) and Vercel's free
  tier easily cover a personal planner. No card required to start.
- **Your data location:** in cloud mode it lives in your Supabase project; in local-only
  mode it's only in that browser. The ↺ button (top-right) resets to the sample data.
- **The anon key is public on purpose** — Row-Level Security is the real guard. Never ship
  the `service_role` key.
- **Sync is last-write-wins.** If you somehow edited the exact same thing on two devices at
  the same instant, the later save wins (no merge). For a solo planner this never bites.
- **Backups:** Supabase keeps your data; for extra safety you can periodically export the
  `plans` table from the Supabase Table Editor.
