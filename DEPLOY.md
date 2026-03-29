# Deploying VEER to Vercel

## Prerequisites

- A [Vercel account](https://vercel.com) (free)
- A [MongoDB Atlas account](https://cloud.mongodb.com) (free M0 tier works)
- A Gmail account with App Passwords enabled (for reminder emails)
- Your code pushed to a GitHub / GitLab / Bitbucket repo

---

## Step 1 — Set up MongoDB Atlas

Vercel is serverless — it cannot connect to a local MongoDB. You need Atlas.

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → **Create a free account**
2. Create a new **Project** → Create a **Cluster** (choose M0 Free)
3. Under **Database Access** → Add a database user:
   - Username: `veer_user`
   - Password: (generate a strong one — save it)
   - Role: `Read and write to any database`
4. Under **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`)
   > Required because Vercel serverless functions have dynamic IPs
5. Go to your cluster → **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://veer_user:<password>@cluster0.xxxxx.mongodb.net/veer?retryWrites=true&w=majority
   ```
   Replace `<password>` with your actual password.

---

## Step 2 — Enable Gmail App Password (for emails)

VEER sends daily reminder and motivation emails via Gmail SMTP.

1. Go to [myaccount.google.com](https://myaccount.google.com) → **Security**
2. Enable **2-Step Verification** (required)
3. Search for **App Passwords** → Create one → name it "VEER"
4. Copy the 16-character password shown (format: `xxxx xxxx xxxx xxxx`)

---

## Step 3 — Push code to GitHub

```bash
cd C:\Users\BIOCIPHER\Documents\VEER

git init
git add .
git commit -m "Initial commit: VEER study tracker"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/veer.git
git branch -M main
git push -u origin main
```

> Make sure `.gitignore` excludes `.env` files — they must never be pushed.

---

## Step 4 — Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select your `veer` repo
3. Vercel will auto-detect the `vercel.json` — **leave all build settings as-is**
4. Before clicking Deploy, go to **Environment Variables** and add every variable below:

### Required environment variables

| Name | Value | Notes |
|------|-------|-------|
| `DATABASE_URL` | `mongodb+srv://veer_user:PASSWORD@cluster0.xxxxx.mongodb.net/veer?retryWrites=true&w=majority` | From Step 1 |
| `JWT_SECRET` | A random 32+ char string | Generate at [generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) |
| `NODE_ENV` | `production` | |
| `CLIENT_URL` | `https://your-app.vercel.app` | Update after first deploy |
| `MAIL_HOST` | `smtp.gmail.com` | |
| `MAIL_PORT` | `587` | |
| `MAIL_USER` | `your_email@gmail.com` | Your Gmail address |
| `MAIL_PASS` | `xxxx xxxx xxxx xxxx` | App Password from Step 2 |
| `MAIL_FROM` | `VEER Study Tracker <your_email@gmail.com>` | |
| `CRON_SECRET` | Any random string | Secures the cron endpoints |

5. Click **Deploy** — wait ~2 minutes

Your app will be live at `https://veer-xxxx.vercel.app`

6. Go back to **Environment Variables**, update `CLIENT_URL` to your actual Vercel URL, then **Redeploy**.

---

## Step 5 — Verify deployment

Open your Vercel URL and check:

- `https://your-app.vercel.app/api/health` → should return `{"status":"ok","app":"VEER API","db":"mongodb"}`
- `https://your-app.vercel.app` → should show the VEER login page

**Demo login:** `demo@veer.com` / `demo123`
> If demo login fails, run the seed script locally once (see below).

---

## Step 6 — Seed demo data (first time only)

The seed script must be run from your local machine against Atlas:

```bash
# Make sure server/.env has your Atlas DATABASE_URL
cd server
npm install
node data/seed.js
```

This creates the demo user and sample data in Atlas.

---

## Step 7 — (Optional) Custom domain

In Vercel dashboard → your project → **Settings → Domains** → add your domain.

---

## How the deployment works

```
Vercel request routing:
  /api/*       →  api/index.js  (Node.js serverless function)
                  └── server/app.js (Express routes)
                      └── Prisma ORM → MongoDB Atlas

  /*           →  client/build/index.html (React SPA)
```

The React app calls `/api/...` which Vercel routes to the serverless Express function — all on the same domain, so no CORS issues.

### Cron jobs (automatic)

Vercel runs these on a schedule (UTC time):

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/daily-reminders` | 2:00 PM UTC (7:30 PM IST) | Sends daily study check-in emails |
| `/api/cron/inactivity-check` | 3:00 PM UTC Thursday | Sends streak-loss warning emails |

---

## Redeployment

Every `git push` to `main` triggers an automatic Vercel rebuild — no manual steps needed.

---

## Local development

```bash
# Terminal 1 — backend (runs on :5000)
cd server && npm install && npm run dev

# Terminal 2 — frontend (runs on :3000, proxies /api to :5000)
cd client && npm install && npm start
```

The React dev server proxies `/api` to `localhost:5000` via `client/package.json` → `"proxy"`.

### Run tests locally

```bash
# Backend tests (Jest + Supertest)
cd server && npm test

# Frontend tests (React Testing Library)
cd client && npm test -- --watchAll=false
```
