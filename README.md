# ADMABS Integrated Business Platform

A POS / operations platform for Admabs Investment (tyres & batteries, fuel, supermarket,
online). One React app serves as both the web interface and the shell for the Android/iOS
apps; a Fastify + MongoDB API backs it.

## Project layout

```
AdmabsInvestment/
  src/            React frontend (Vite) — also the mobile UI, wrapped by Capacitor
  server/         Fastify + MongoDB backend API
  android/        Capacitor Android native project (generated, but committed)
  capacitor.config.json
```

## Running it locally

**Backend** (in `server/`):
```
cd server
npm install
npm run seed     # creates demo branches, products, customers, sales, users
npm run dev      # starts the API on http://localhost:4000
```
No MongoDB install is required for local development — if `MONGODB_URI` is left blank in
`server/.env`, the server automatically starts a local, file-backed MongoDB (data kept in
`server/.mongo-data`, persists across restarts). For production, set `MONGODB_URI` to a
MongoDB Atlas connection string.

**Frontend** (in the project root):
```
npm install
npm run dev      # starts the app on http://localhost:5173
```
The frontend reads the API URL from `VITE_API_URL` in `.env` (defaults to
`http://localhost:4000/api`).

### Import the verified legacy stock

The repository includes the warehouse-specific export captured from the legacy ADMABS
system. Validate it without changing the database:

```bash
npm --prefix server run migrate:legacy
```

Apply the migration to the configured `MONGODB_URI`:

```bash
npm --prefix server run migrate:legacy:apply
```

The apply command first writes a complete JSON backup, deletes only records referenced by
active demo batches, then upserts the 10 legacy locations and their independent inventory.
It is safe to rerun: legacy source IDs update existing imported records instead of adding
duplicates. Branches, outlets, names, quantities, prices and product details remain editable
from the Super Admin interface after import.

### Demo logins
Seeded by `npm run seed` — username and password are the same for each role:

| Role | Username / Password |
|---|---|
| CEO / Director | ceo / ceo |
| General Manager | gm / gm |
| Branch Manager | branch / branch |
| Finance Manager | finance / finance |
| Sales Attendant | staff / staff |
| Fuel Attendant | fuel / fuel |

## What's wired to the real backend today

Login, Dashboard (revenue/profit/receivables/alerts/recent transactions), Inventory (stock
levels), Point of Sale (product catalog + posting real sales that decrement stock),
Customers, Expenses (submit/approve/reject), and Approvals (approve/reject).

Everything else (Fuel Station, full Finance module, Procurement UI, Loyalty, Services, HR
& Payroll, Cash-up, Layby, Tyre Finder, Marketing, Assets, Price Lists, Reports, Staff,
Website, Settings) still runs on the original in-app demo data — next up for wiring to
the backend as we keep building this out.

## Packaging as a mobile app

The frontend is already built mobile-first (a phone-width card centered on screen), so the
same code is the web app and the app shown inside the native shell.

**Android (.apk)** — ready to go on this machine once Android Studio is installed:
```
npm run cap:android
```
This builds the web app, syncs it into `android/`, and opens the project in Android Studio,
where you can run it on an emulator/device or build a signed `.apk` / `.aab` via
Build → Generate Signed Bundle/APK.

**iOS (.ipa)** — Capacitor supports iOS, but building it requires Xcode, which only runs on
macOS, plus an Apple Developer account ($99/yr) to sign and distribute. That can't be done
from this Windows machine. When you're ready, either use a Mac (or a cloud Mac build service
like Codemagic/Ionic Appflow) and run `npx cap add ios` there, or we set up a PWA
(installable from Safari, no Apple account needed) as a stand-in in the meantime — the same
approach used for Kobies TechZone.

Before shipping a real device build, point `VITE_API_URL` (in `.env`) at your deployed
backend URL instead of `localhost` — a phone can't reach your dev machine's localhost.
