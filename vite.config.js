import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must match your GitHub repo name for GitHub Pages to
// resolve assets correctly, e.g. https://<user>.github.io/goosebrief/
// If you deploy to a custom domain or a user/org root page instead,
// change this to "/".
export default defineConfig({
  plugins: [react()],
  base: "/goosebrief/",
});
