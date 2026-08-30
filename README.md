# StaffTrack — free employee attendance web app

A simple Next.js + Supabase attendance system with employee registration, daily attendance, monthly Excel export, and a weekly email report.

## 1. Create Supabase project
1. Create a free Supabase project.
2. In SQL Editor, run `supabase/schema.sql`.
3. In Authentication, create your admin user (email + password).
4. Copy Project URL, anon key, and service-role key.

## 2. Configure local environment
Copy `.env.example` to `.env.local` and fill values.

## 3. Run
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## 4. Deploy free
Push this folder to GitHub and import it into Vercel. Add all environment variables from `.env.example` in Vercel.

For weekly email, create a Resend account, add/verify a sending domain or use the sender address allowed by your Resend account, then set `RESEND_API_KEY`, `REPORT_TO_EMAIL`, and `REPORT_FROM_EMAIL`.

Vercel Cron calls `/api/weekly-report` every Monday at 12:00 UTC. It authenticates with `CRON_SECRET`.

## Important security note
The browser export endpoint currently requires a Supabase access token in the Authorization header. The visible download button is intentionally a simple starting point; for production, change the button to fetch the endpoint with the current Supabase session token and download the returned blob. The weekly endpoint uses the service-role key only on the server.

## Features
- Admin login
- Employee registration
- Daily Present / Absent / Leave / Half-day marking
- Search employees
- Monthly Excel export
- Weekly Excel email
- Cloud database and auth
- Responsive mobile UI
