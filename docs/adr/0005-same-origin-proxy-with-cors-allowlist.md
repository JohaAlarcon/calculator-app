# Same-origin proxy for the UI, CORS allowlist for direct clients

The browser always calls the API at the relative path `/api`: in Docker, nginx serves the UI and reverse-proxies `/api/*` to the backend; in local development, the Vite dev server does the same. The frontend build therefore contains no API host and needs no CORS. The backend is still exposed directly (port 8080) for curl and other clients, so it sends CORS headers for an explicit, configurable `ALLOWED_ORIGINS` allowlist (default `http://localhost:3000`) — never `*`.

## Considered Options

- **Direct cross-origin calls from the UI** — rejected: bakes the API URL into each build and makes CORS configuration a deployment concern in every environment.
