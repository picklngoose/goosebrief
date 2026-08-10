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

- Data is stored in the browser's `localStorage`, per device/browser — it
  doesn't sync across devices. If you need shared/synced storage across your
  team, that'd need a small backend or a service like Firebase/Supabase.
- Each case supports a **GooseFlow link** field, and each flow you log can be
  copied as structured JSON for pasting into GooseFlow or a doc, until the
  two apps are wired together more directly.
