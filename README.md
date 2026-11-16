# BPS Admissions CRM

Lead management CRM for **Birla Public School, Kishangarh**: every admission enquiry from
Facebook, Instagram, Google Ads, the school website, walk-ins and phone calls lands in one place,
gets assigned to a teacher / counselor, and is tracked until admission.

## Features

| Area | What it does |
|---|---|
| Lead capture | Meta Lead Ads webhook (FB + Insta), Google Ads lead-form webhook, website form API (with UTM / GCLID / FBCLID), manual entry, CSV import |
| Duplicates | Same mobile number → no new lead; the old lead gets an "enquired again" entry and a ×N badge |
| Assignment | Automatic round robin among counselors, or manual. Bulk assign / re-assign |
| Pipeline | New → Contacted → Interested → Visit Scheduled → Visit Done → Form Filled → Interaction/Test → Admission Confirmed / Lost (with reason) |
| Calling | One-tap call & WhatsApp, call outcome log, call count, first-response time, next follow-up |
| Follow-ups | Reminders per counselor, overdue / today / upcoming |
| Board | Drag-and-drop Kanban |
| Reports | Funnel, source & campaign conversion, ad spend, cost per lead / admission, lost reasons, class-wise demand, counselor performance |
| Meta sync | Conversions API for CRM: sends lead stages back to Meta so ads optimise for real admissions. Ad spend sync from the ad account |
| Google | Offline conversion CSV (GCLID) for Google Ads |
| Roles | Super Admin, Admin, Counselor/Teacher (own leads only), Viewer (read only) |
| Safety | Soft delete + Trash, permanent delete only by Super Admin, full audit log, export only for admins |

## Tech

Next.js 15 (App Router, TypeScript) · PostgreSQL · Prisma · Tailwind CSS. Works on phones (installable as an app).

## Run locally

```bash
cp .env.example .env          # fill DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate deploy
SEED_DEMO=1 npm run db:seed   # first Super Admin + demo data (omit SEED_DEMO in production)
npm run dev                   # http://localhost:3000
```

Default Super Admin: `superadmin@bps.local` / `ChangeMe@123` (override with `SUPERADMIN_EMAIL` and
`SUPERADMIN_PASSWORD` when seeding). **Change it immediately.**
Demo users (only with `SEED_DEMO=1`): `admin@`, `neha@`, `rakesh@`, `pooja@`, `viewer@bps.local`, password `Demo@1234`.

## Deploy on the school sub-domain (e.g. `crm.yourschooldomain.com`)

A small VPS is enough (1–2 GB RAM, Ubuntu 22.04/24.04, e.g. DigitalOcean / Hostinger VPS).

1. **DNS:** in the domain panel add an `A` record: `crm` → server IP.
2. **Server packages**
   ```bash
   sudo apt update && sudo apt install -y nginx postgresql certbot python3-certbot-nginx
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
   sudo npm i -g pm2
   ```
3. **Database**
   ```bash
   sudo -u postgres psql -c "CREATE USER crm WITH PASSWORD 'STRONG_PASSWORD';"
   sudo -u postgres psql -c "CREATE DATABASE bps_crm OWNER crm;"
   ```
4. **App**
   ```bash
   cd /var/www && git clone <your-repo> bps-crm && cd bps-crm
   cp .env.example .env && nano .env      # DATABASE_URL, AUTH_SECRET (openssl rand -base64 48), APP_URL, keys
   npm ci && npx prisma migrate deploy && npm run db:seed && npm run build
   pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
   ```
5. **Nginx + HTTPS**
   ```bash
   sudo cp deploy/nginx-crm.conf /etc/nginx/sites-available/crm   # edit server_name
   sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d crm.yourschooldomain.com
   ```
6. **Backups:** `crontab -e` → `30 2 * * * /var/www/bps-crm/deploy/backup.sh`

Update later: `git pull && npm ci && npx prisma migrate deploy && npm run build && pm2 restart bps-crm`.

## Connecting the lead sources

All setup steps with the exact URLs are shown inside the CRM at **Settings & Integrations** (Super Admin).

- **Website:** `POST /api/webhooks/website` with header `x-api-key: WEBSITE_FORM_KEY`. A ready-to-paste form snippet is on the Settings page.
- **Meta Lead Ads:** Meta app → Webhooks (Page → `leadgen`) → `https://crm.../api/webhooks/meta`, verify token `META_VERIFY_TOKEN`.
  Needs `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN` (leads_retrieval). Start App Review / Business Verification early.
- **Meta Conversions API for CRM:** `META_DATASET_ID`, `META_CAPI_ACCESS_TOKEN`; choose which stages to send in Settings.
- **Meta ad spend sync:** `META_AD_ACCOUNT_ID`, `META_ADS_ACCESS_TOKEN` (ads_read) → button on Reports.
- **Google Ads lead form:** webhook URL `https://crm.../api/webhooks/google`, key `GOOGLE_LEAD_FORM_KEY`.
- **Google offline conversions:** Settings → download CSV → upload in Google Ads.

## Project layout

```
prisma/schema.prisma      database tables
prisma/seed.ts            first Super Admin + optional demo data
src/lib/                  auth, permissions (role matrix), lead ingest + dedupe, Meta API, settings
src/app/api/webhooks/     meta, google, website endpoints
src/app/actions/          server actions (leads, users, import, spend, settings)
src/app/(app)/            pages: dashboard, leads, board, follow-ups, reports, import, users, trash, settings, audit
deploy/                   nginx, pm2, backup script
```
