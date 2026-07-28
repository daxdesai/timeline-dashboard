# Timeline Dashboard — Implementation Notes

## Running locally

```bash
cd timeline-dashboard
npm install
cp .env.example .env   # or set VITE_API_BASE_URL
npm run dev
```

Test credentials: `analytics_user` / `dashboard123`  
Data dates: **22–25 June 2026**

**Live demo:** https://timeline-dashboard-rho.vercel.app

---

## Session & token management

**Storage:** `localStorage` under key `access_token`.

**Why localStorage:** The assignment requires refresh-on-load persistence. `localStorage` survives tab close and full page reload, which matches operator dashboards that stay signed in across shifts. The trade-off is XSS exposure — any script on the origin can read the token. Mitigations in this app: no `dangerouslySetInnerHTML`, minimal third-party scripts, and immediate token clearing on 401.

**Flow:**
1. Login → `POST /auth/login` → store `access_token` in `localStorage`.
2. All authenticated calls go through `apiRequest()` in `src/api/client.ts`, which attaches `Authorization: Bearer <token>`.
3. On app boot, `AuthProvider` reads the token and validates via `GET /auth/me` before rendering protected routes.
4. Any 401 from authenticated endpoints clears the token, invokes a central handler, and redirects to `/login`.
5. Logout → `POST /auth/logout` → clear token → redirect.

---

## State & data fetching

**React Query (TanStack Query)** for server state: caching, deduplication, retry, and refetch on filter changes. Auth/session stays in React Context because it is client-owned and drives routing.

---

## Chart performance (10k–20k individual produces)

**Approach:** Custom **Canvas 2D** renderer (not SVG/DOM).

**Why:** SVG/React nodes per marker do not scale to 20k elements. Canvas draws in one paint pass and keeps the DOM tree small.

**Pipeline:**
1. **Precompute once** when data changes (`buildChartMarkers` → `projectMarkers`): timestamps, cumulative Y, pixel coords, colors, tooltip strings. No date parsing in the draw loop.
2. **Downsample PASS markers only** when zoomed out (`downsamplePassMarkers`): bin by pixel column, keep ≤2 PASS per column. **FAIL markers are never dropped.**
3. **Hover** uses the full projected marker list with distance check — accurate tooltips even when display is thinned.
4. **ResizeObserver** + `devicePixelRatio` scaling for crisp rendering.
5. **`exact_produces: true`** is requested only when the toggle is on, avoiding large payloads otherwise.

---

## Timezone (UTC ↔ IST)

All API timestamps are UTC. UI uses **Asia/Kolkata (IST, +05:30)** via `date-fns-tz`:

- **Outbound:** `buildShiftTimeRange()` combines date + shift `HH:MM` in IST, converts to UTC ISO for `time_range`.
- **Inbound:** `utcToIstMs()` converts segment and produce timestamps for chart bands and table bucketing.
- **Hourly table:** IST **clock-hour** columns (e.g. 08:00–09:00). Segments are clipped at hour boundaries with `overlapMinutes()`. `produce_counts` and cycle-time rows match via `bucket_start` → IST clock hour.
- **In-progress shifts:** buckets with `hourStartMs >= now` render blank (not zero).

---

## Assumptions & scope cuts

**Assumptions:**
- Asset selector flattens the full tree with indentation; default selects the first site-level node (`assetlevel_id === 40`, falling back to line/machine levels).
- Hourly chart markers (toggle off) use bucket midpoint + cumulative totals; cumulative line connects hourly points.
- Hourly table **Unknown Downtime** counts only `type: "unknown"` downtimes (per assignment §2.4). The chart still renders planned/unplanned/unknown downtime bands with distinct colours via `classifyDowntime()`; those non-unknown minutes are visible on the chart but intentionally excluded from the table rows.

**Out of scope (per assignment):** segment classification dialogs, auto-refresh/polling, export, i18n, multi-theme, asset hierarchy browser view, “Point labels” toggle from screenshots, NOW indicator, asset-level filter from screenshots.

**Not cut:** auth, filters, canvas chart with zoom, hourly table with cycle times, loading/error/empty states, manual refresh.
