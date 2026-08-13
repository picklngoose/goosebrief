[README.md](https://github.com/user-attachments/files/31034021/README.md)
# GooseBrief

Case prep tracker for team policy debate — log the aff cases you're seeing,
rank them by how many teams are running them, rate case strength, link your
neg briefs, and attach flows per case.

## Local dev

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages (via GitHub Actions)

1. Create a new GitHub repo named `goosebrief` (or update `vite.config.js`
   if you name it something else — the `base` path must match the repo name).
2. Push this project to the repo's `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/goosebrief.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages** and set **Source** to
   **GitHub Actions**.
4. Push to `main` (or re-run the workflow from the **Actions** tab) and the
   site will build and deploy automatically.
5. Your app will be live at `https://<your-username>.github.io/goosebrief/`.

## Notes

- Data is stored in Firebase Realtime Database and synced live across
  devices/browsers.
- Each case's flows are full flow boards (columns for 1AC–2AR, draggable
  argument cells, and cross-column connections) built right into the
  "add flow" section — no separate app or link needed.
- Access is per **caselist**: sign in with Google, then create a caselist
  (you become its owner and get a join code to hand out) or join one with
  its name and code. Everything a team logs — cases, flows, notes — lives
  under that caselist and is only visible to its members.

## One-time setup for Google sign-in + caselists

If you're setting this up fresh or upgrading from an earlier passcode-only
version of GooseBrief, do these once, in order:

1. **Enable Google sign-in** — Firebase console → Authentication →
   Sign-in method → enable **Google**.
2. **Authorize your domain** — same Authentication page → Settings →
   Authorized domains → add `<your-username>.github.io` (and `localhost`
   is usually already there for local dev).
3. **Deploy the new code** — push this version so the live app has the
   sign-in flow before you lock down the database.
4. **Publish `database.rules.json`** — Firebase console → Realtime
   Database → Rules → paste in the contents of `database.rules.json` from
   this project → Publish.
5. **Sign in and create (or join) a caselist.** If your database already
   had cases from before caselists existed, the "create caselist" screen
   will offer to import them automatically — check the box and they'll be
   copied into your new caselist. The original data is left in place
   untouched, so nothing is destroyed if you skip this or it doesn't look
   right; you can always re-import later.
6. Share the caselist's **name** and **join code** with the rest of your
   team (Members panel in the app header has both, with a copy button).
   Anyone who joins gets full access; only the owner can remove members or
   regenerate the join code.

The old shared `TEAM_PASSCODE` is gone — Google sign-in plus caselist
membership is what controls access now. Two things worth knowing:

- A caselist's join code isn't a per-person password — it's a shared
  secret like the old passcode, just scoped to one caselist instead of your
  whole database. Anyone who has it can join.
- This stops people who skip the app entirely (raw scripts hitting your
  database URL) but doesn't add anything beyond that: someone with the
  join code who's willing to sign in with any Google account can still get
  in. That's an appropriate level of friction for a trusted team tool, not
  a vault.
