# Connectly — Frontend

A polished React + Vite + Tailwind frontend for Connectly, in the Midnight
Blue + Cyan visual identity — now wired to the real backend in `../backend`
rather than local mock data. **This project won't do much on its own; start
the backend first.** See the root `README.md` for running both together.

## Tech stack

- **React 19 + Vite** — app shell and dev/build tooling
- **Tailwind CSS 3** — utility-first styling, custom theme tokens, `class`-based dark mode
- **React Router 7** — client-side routing, with a real auth guard (`RequireAuth`)
- **Framer Motion** — page/element transitions, modal and dropdown animations, like-button micro-interaction
- **lucide-react** — icon set
- **Vitest + Testing Library + jsdom** — automated tests (with the backend mocked at the `fetch` layer, so they run without a live server)

No Bootstrap, Material UI, Angular, Vue, or Next.js, per the brief.

## Getting started

This folder is **tier 1 (web)** of the 3 tier setup. Start the API (tier 2) and PostgreSQL (tier 3) first; see the root `README.md`.

```bash
npm install
npm run build      # production build to dist/
npm start          # web tier: serves dist/ on http://localhost:8080 and forwards /api and /uploads to the API
```

Other scripts:

```bash
npm run dev        # development server with hot reload on http://localhost:5173 (also forwards /api)
npm run lint       # oxlint static analysis
npm test           # automated UI tests (backend mocked, no live server needed)
```

The API address defaults to `http://localhost:4000`. If the API runs elsewhere, set `APP_TIER_URL` before starting, for example `APP_TIER_URL=http://192.168.1.20:4000 npm start`.
