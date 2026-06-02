import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
//
// base:
//   - Vercel / Netlify / Cloudflare Pages  -> leave as '/'
//   - GitHub Pages                          -> set to '/<your-repo-name>/'
//     e.g. base: '/grid-planner/'
export default defineConfig({
  plugins: [react()],
  base: '/',
})
