# SFMS Frontend

React 19 + TypeScript + Vite frontend for the Samartex Co-Operative Credit
Union File Management System.

## Requirements

- Node.js 22 (see `netlify.toml`; Vite 5 needs Node 18+)
- The backend API running on `http://localhost:8000`

## Local development

```bash
npm install
npm run dev        # http://localhost:4000
```

The dev server is pinned to port **4000** with `strictPort: true`, because
that origin is in the backend's CORS allowlist (`CORS_DEV_PORTS`).

## API base URL

`src/lib/api.ts` resolves the API root once at start-up:

| Condition | Value |
|---|---|
| `VITE_API_BASE_URL` is set | that value (trailing slashes trimmed) |
| Host ends with `.netlify.app` | `https://saxccudrive.onrender.com` |
| Anything else | `http://<current host>:8000` |

`VITE_API_BASE_URL` is a **build-time** variable: changing it requires a
rebuild, not just a restart.

## Build

```bash
npm run build      # tsc -b && vite build -> dist/
npm run preview    # serve the production build locally
npm run lint
```

## Deployment (Netlify)

The site is built from this repository — every push to `main` triggers a
deploy, so `dist/` is **not** committed. Netlify is configured entirely by
`netlify.toml`:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | `22` |
| Environment variable (optional) | `VITE_API_BASE_URL=https://saxccudrive.onrender.com` |

### SPA fallback

This is a single-page app, so every client-side route (`/login`, `/settings`,
…) must serve `index.html` rather than Netlify's 404 page. The rewrite is
defined in two places, on purpose:

- `netlify.toml` → `[[redirects]]`, used when Netlify builds from this repo.
- `public/_redirects` → copied into `dist/`, so a manual drag-and-drop
  deployment of the built folder behaves the same way.

Check a deployment with:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://saxccudrive.netlify.app/login   # 200, not 404
```
