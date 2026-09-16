# PhysioAlign

A webcam posture checker for yoga and physio exercises. Pick a pose and it tracks your joints live. It tells you what to fix (on screen and out loud) and times how long you hold good form. After the session, Gemini writes a short report.

- **Patients** practise poses, track progress and chat with AI coaches.
- **Doctors** review their assigned patients' sessions and set care plans.
- **Admins** manage accounts, approve doctors and assign patients to doctors.

Pose tracking runs in the browser with MediaPipe, so video never leaves your machine. Joint angles are calculated in 3D from MediaPipe's world landmarks and compared against target ranges for each pose in [`src/data/poses.ts`](src/data/poses.ts).

**Stack:** React + TypeScript (Vite), Express, PostgreSQL, MediaPipe Tasks Vision, Google Gemini.

## Run locally

Needs Node 18+ and a Postgres database.

```bash
npm install
cp .env.example .env   # fill in the values
npm run dev:full       # frontend on :5173, API on :5001
```

Tables are created automatically on first start. To check the database connection, run `npm run db:check`.

## Environment variables

| Variable | |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Random string used to sign login tokens (`openssl rand -hex 32`) |
| `GEMINI_API_KEY` | Gemini key. Without it you get placeholder reports. |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in client ID. Needed at build time. |
| `ADMIN_EMAILS` | Comma-separated emails allowed to sign up as admin. If empty, only the first account can. |

## Deploying on Render

`render.yaml` sets up a single web service. It builds the frontend, and Express serves it together with the API.

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start`
- Health check: `/api/health`

Set the environment variables above in the Render dashboard. For Supabase, use the **connection pooler** URL. Render can't reach Supabase's direct connection, which is IPv6 only. Also add your Render URL to the authorised JavaScript origins of the Google OAuth client.

## Notes

- New doctor accounts can't see any patient data until an admin approves them. After that, a doctor only sees the patients assigned to them.
- Login and signup are rate limited to 20 requests per 15 minutes per IP.
- This is a personal project, not a medical device.
