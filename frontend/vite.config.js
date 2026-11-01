import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// =============================================================================
//  The frontend's Vite server acts as the WEB TIER when running locally.
//
//    Browser ──> Web tier (this, port 8080) ──/api, /uploads──> App tier (port 4000)
//                                                             ──> Data tier (PostgreSQL 5432)
//
//  The browser only ever talks to the web tier. Requests for /api/* and
//  /uploads/* are forwarded (proxied) to the Node.js API, exactly the job
//  Nginx will do on AWS (see deploy/nginx/connectly.conf).
//
//  Set APP_TIER_URL if the API runs somewhere other than localhost:4000.
// =============================================================================
const APP_TIER_URL = process.env.APP_TIER_URL || "http://localhost:4000";

const proxy = {
  "/api": { target: APP_TIER_URL, changeOrigin: false, xfwd: true },
  "/uploads": { target: APP_TIER_URL, changeOrigin: false, xfwd: true },
};

export default defineConfig({
  plugins: [react()],
  // `npm run dev`: development server with hot reload.
  server: { port: 5173, proxy },
  // `npm run build` then `npm start`: serves the production build (web tier).
  preview: { port: 8080, strictPort: true, proxy },
  test: {
    environment: "jsdom",
    setupFiles: "./src/__tests__/setup.js",
    globals: true,
  },
});
