# SLUGGER widget registration — Available Player Portal

This application can run **standalone** (browser hits your Next.js origin directly) or be **embedded in SLUGGER** as a widget inside an iframe. This document lists prerequisites, environment alignment, CSP / framing, and a practical checklist.

> **Note:** Exact steps in the SLUGGER admin UI may change; treat the **widget ID**, **allowed origins**, and **API base URL** as the contract you must keep in sync with this repo.

---

## Prerequisites

- A **deployed** Next.js app URL for the widget (e.g. `https://portal.example.com`).
- A **deployed** Express API URL reachable from the browser (`NEXT_PUBLIC_API_URL`) and from any server-side code that calls SLUGGER APIs.
- SLUGGER project access to **register a widget** and configure **allowed parent origins** (or equivalent CSP / embedding settings).

---

## Registration steps (conceptual)

1. **Create or select a widget** in SLUGGER whose **`widget_id`** matches this app’s configuration.
2. Set **`SLUGGER_WIDGET_ID`** in the API (and any server code that identifies the widget) to that same id. Default in `.env.example` is `available-player-portal` — change it if your registration uses another id.
3. Set **`SLUGGER_API_BASE_URL`** to the SLUGGER deployment that exposes APIs your backend calls (e.g. `https://alpb-analytics.com`). Example usage in repo comments: `/api/users/me` for identity.
4. Set **`NEXT_PUBLIC_SLUGGER_ORIGINS`** to a **comma-separated** list of parent origins allowed to embed the app, e.g.  
   `https://alpb-analytics.com,http://localhost:3000`  
   Use this when configuring **Content-Security-Policy `frame-ancestors`** (or SLUGGER’s UI equivalent) so the iframe is only loaded from trusted parents.

---

## Next.js: CSP and `frame-ancestors`

Widgets in iframes require the **child** (this app) to allow being framed by the **parent** (SLUGGER).

- Today, `apps/web/next.config.ts` does **not** ship a CSP header; you should add `headers()` that set, at minimum:

  - `Content-Security-Policy` with `frame-ancestors` listing each origin in `NEXT_PUBLIC_SLUGGER_ORIGINS` (and `'self'` if you also load the app standalone).

- Do **not** set `X-Frame-Options: DENY` on the widget routes if SLUGGER must embed them.

A commented example existed in earlier stubs; implement production values to match your real SLUGGER and portal hostnames.

---

## Environment summary

| Variable | Where | Purpose |
|----------|--------|---------|
| `SLUGGER_API_BASE_URL` | API (server) | Base URL for SLUGGER HTTP APIs |
| `SLUGGER_WIDGET_ID` | API (server) | Must match widget id registered in SLUGGER |
| `NEXT_PUBLIC_SLUGGER_ORIGINS` | Web (build) | Document / drive CSP allowlist for embedders |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Web | Standalone NextAuth when not using SLUGGER-only auth |

---

## Testing in a SLUGGER widget test page

1. Deploy **web + API** to URLs you can point SLUGGER at (or use localhost with SLUGGER dev if supported).
2. Set **`NEXT_PUBLIC_API_URL`** to the API URL the **browser** can call (often public HTTPS).
3. Register the widget iframe URL in SLUGGER to your Next app route (e.g. `/dashboard` or root).
4. Open SLUGGER’s widget preview / test harness and confirm:
   - Iframe loads without CSP violations.
   - Player list loads (`GET /players` succeeds; CORS allows the web origin).
   - Optional: **Refresh database** works only if `POST /api/sync` can reach the API from the Next server.

---

## Production checklist

- [ ] **`SLUGGER_WIDGET_ID`** matches SLUGGER registration.
- [ ] **`SLUGGER_API_BASE_URL`** points to production SLUGGER.
- [ ] **`NEXT_PUBLIC_API_URL`** is the production API URL (HTTPS).
- [ ] **CSP `frame-ancestors`** includes all SLUGGER and portal origins that may embed the app.
- [ ] **CORS** on the API allows the **web** origin (not only `*` in production).
- [ ] **`SYNC_INTERNAL_KEY`** set if the sync button or `POST /sync` must not be public.
- [ ] Smoke-test **Player Discovery Home** and **player detail** inside the iframe.

---

## Related documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — hosting and env
- [API_SPEC.md](./API_SPEC.md) — REST contract used by the embedded UI
