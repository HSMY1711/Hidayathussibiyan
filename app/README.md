# Jashne Rabeeh — Hidayathussibiyan Madarasa

A complete production-style management system for the Jashne Rabeeh annual fest:
public page + full admin side, with a real backend (Node.js/Express), database
(SQLite), authentication, PDF generation, and server-side permission enforcement.

## Run

```bash
npm install
npm run build      # builds the frontend into dist/
npm start          # serves the app + API on http://localhost:3001
```

For development (frontend hot-reload on :3000 with API proxy):

```bash
npm run dev:server   # backend on :3001
npm run dev          # vite on :3000
```

## First sign-in

- URL: `/admin/login`
- Default Owner account: **owner / owner123**

> Change this password immediately (Settings → Your Password). You can also set a
> different initial password before first launch with `OWNER_PASSWORD=... npm start`.
> Set a strong `JWT_SECRET` environment variable in any real deployment.

## Architecture

- `server/index.cjs` — Express API: auth (JWT httpOnly cookie + bcrypt), all admin
  and public endpoints, lock enforcement on the server, PDF storage/serving.
- `server/db.cjs` — SQLite schema + seed (Owner account, two teams, default settings).
- `server/pdf.cjs` — A4 PDF generators (pdfkit): team member lists, participant
  competition lists, judge marking sheets (4 program sections per sheet).
- `src/` — React + TypeScript + Vite + Tailwind frontend. `/` is the public page;
  `/admin/*` is the administration side.
- `data/` — runtime SQLite database, uploaded logo, saved PDFs (created automatically).

## Key rules implemented

- Two teams, names editable by Admin (never hard-coded).
- Hierarchy Team → Zone → Gender → Participant; zones: Ground / Zero / High / General.
- Chest numbers auto-generated: JR-100+ Ground, JR-200+ Zero, JR-300+ High, JR-400+ General,
  continuous within a zone across genders (girls continue after boys), unique always;
  zone moves reassign numbers safely.
- All counts (total / team / zone / gender) are calculated from the database.
- Programs are Draft until explicitly announced; public stats derive from this.
- Results entered by Chest No. only; participant identity resolved server-side.
- Position marks (default 10 / 8 / 5) configurable; participant score = position marks
  + calculated judge marks (J1 + J2 + J3); team scores and rankings derive from the same
  source records — no duplicated manual totals.
- PDFs are saved in the system; only published PDFs are publicly viewable (inline, no
  download control); Admin can publish / unpublish / update / remove.
- Public page: logo + name (editable), published documents, 4 statistic cards, program
  selection flow (gender → zone → program), 1st/2nd/3rd results (or "Results not
  announced yet"), Chest No. score lookup, live team scoreboard, Star of the Fest
  (Boys) and Pen of the Fest (Girls) honours.
- Jashne Rabeeh Lock: when locked, every mutating admin API returns 423 server-side;
  the public site keeps working. Only authenticated Owner/Admin can lock/unlock.
- Owner can create Admin accounts and reset passwords; the Owner account cannot be
  removed; no credentials or admin controls are exposed publicly.

## Security notes

Server-side validation on every write, httpOnly session cookies, bcrypt password
hashing, role checks on the backend (never the browser), and inline-only public PDF
serving. For internet-facing deployment, run behind HTTPS and set `JWT_SECRET`.
