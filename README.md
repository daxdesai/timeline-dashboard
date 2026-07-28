# Timeline Dashboard

React + TypeScript dashboard for production timeline analytics (Noviga assignment).

**Live demo:** https://timeline-dashboard-rho.vercel.app

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` (default: `https://fractaldmsdev.centralindia.cloudapp.azure.com`).

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run preview` — preview production build

## Credentials

- Username: `analytics_user`
- Password: `dashboard123`
- Query dates: 22–25 June 2026

See [NOTES.md](./NOTES.md) for architecture decisions.

## Deployment

Production is hosted on Vercel: https://timeline-dashboard-rho.vercel.app

Set `VITE_API_BASE_URL` in the Vercel project environment (already configured for production).
