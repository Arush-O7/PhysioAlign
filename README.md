# PhysioAlign

PhysioAlign turns a laptop webcam into a posture checker for yoga and physio exercises. You pick a pose, stand in front of the camera, and it tracks your joints live, tells you what to fix (on screen and out loud), and times how long you hold good form. After the session, Gemini writes up a short report on what went well and what to work on.

There are three roles:

- **Patients** practise poses, log daily pain levels, see their progress charts and chat with one of three AI coaches.
- **Doctors** see their patients' session history, export it as CSV, and assign a care plan (which poses, how long to hold, how often).
- **Admins** manage accounts, change roles and assign patients to doctors.

## How it works

Pose tracking runs fully in the browser with MediaPipe's Pose Landmarker (lite model, WASM + GPU). Video never leaves your machine; only the per-second scores and angles get saved.

For each frame the app takes the 2D landmark positions and works out the angle at each joint (knees, hips, elbows, shoulders, ankles) from the two neighbouring points. Each pose in [`src/data/poses.ts`](src/data/poses.ts) has a target range per joint. A frame starts at 100 and loses points for every joint that's outside its range. Tree Pose, Warrior I and Warrior II have their own checks so they work whichever leg is in front and whether your hands are overhead or in prayer position.

Once a second the current score is logged. Any second at 70 or above counts towards hold time. When you finish, the log goes to the backend, which asks Gemini for a critique and saves the whole session in Postgres.

Supported poses: Tree, Warrior I, Warrior II, Downward Dog, Cobra, Chair, Plank, Bridge and Triangle.

## Stack

- React 18 + TypeScript, built with Vite
- `@mediapipe/tasks-vision` for pose detection
- Express backend with PostgreSQL (I use Supabase, but any Postgres works)
- Google Gemini (`gemini-2.5-flash`, falls back to `-lite`) for reports and coach chat, called only from the server
- Recharts for the graphs
- Plain CSS, no UI framework. State lives in a small store built on `useSyncExternalStore`.

## Running it locally

You'll need Node 18+ and a Postgres database.

```bash
git clone https://github.com/Arush-O7/PhysioAlign.git
cd PhysioAlign
npm install
cp .env.example .env   # then fill in the values
npm run dev:full
```

`dev:full` starts Vite on http://localhost:5173 and the API on port 5001 (Vite proxies `/api` to it). The tables are created automatically the first time the server starts.

### Environment variables

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. SSL is turned on automatically unless the host is localhost. |
| `AUTH_SECRET` | Signs login tokens. Use a long random string (`openssl rand -hex 32`). If it's missing, a random one is used and everyone gets logged out when the server restarts. |
| `GEMINI_API_KEY` | Gemini key from [AI Studio](https://aistudio.google.com/). Only the backend reads it. Without it the app still works, but you get canned reports. |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID for "Sign in with Google". Email/password login works without it. |
| `ADMIN_EMAILS` | Optional, comma separated. Only these emails can sign up as admin. If it's empty, only the first account can pick admin. |
| `CORS_ORIGIN` | Optional. Only needed if the frontend is hosted somewhere other than the API. |
| `PORT` | Optional, defaults to 5001. |

To check that the database connection works, run `npm run db:check`. It inserts a throwaway user and deletes it again.

### Production build

```bash
npm run build
npm start
```

Express serves the built `dist/` folder along with the API, so it's a single process to deploy.

## Project layout

```
backend/
  server.js        API routes (auth, sessions, doctor + admin endpoints)
  auth.js          tokens, password hashing, google token check, role checks
  db.js            pg pool and schema setup
  gemini.js        session critique, coach chat and doctor insight prompts
scripts/
  check-db.js      quick database connectivity test
src/
  components/      screens (landing, session, debrief, doctor/admin portals...)
  data/poses.ts    pose definitions and scoring
  game/store.ts    app state and API calls
  utils/           angle maths, audio cues, auth and api helpers
```

## Auth and roles

Email/password and Google sign-in both end with the server handing back a signed token (HMAC-SHA256, valid for 7 days). The frontend sends it with every API call. The server works out who you are from the token and never from IDs in the request body. Google ID tokens are checked with Google before a token is issued. Passwords are hashed with PBKDF2 (210k iterations), and older hashes are upgraded the next time that user logs in.

- Patients can only read and delete their own sessions and profile.
- Doctors and admins can see patient data. Only admins can reach the admin endpoints.
- Roles are read from the database on every request, so a promotion or demotion applies straight away.
- Nobody can make themselves an admin: see `ADMIN_EMAILS` above. After the first admin exists, other admins are promoted from the admin portal.

## Limitations

This is a project, not a medical device, so don't use it in place of an actual physiotherapist.

- Anyone can sign up as a doctor, and doctors can see every patient, not just the ones assigned to them. That's fine for a demo but would need an approval step for real use.
- The angles come from a 2D projection, so it works best when you stand side-on or facing the camera, depending on the pose.
- There's no rate limiting on login yet.
