# VEER — SSC CGL Study Tracker

A full-stack study tracking PWA for SSC CGL aspirants. Built with React, Node.js/Express, and MongoDB.

---

## Features

- **Dashboard** — today's study time, streak, subject breakdown, weekly chart
- **Study Timer** — start/pause/stop with subject & topic selection, auto-saves to DB
- **Topic Tracker** — full SSC CGL syllabus (110+ topics), mark Not Started / In Progress / Completed
- **Daily Log** — view sessions by day or week with subject breakdown
- **Mock Test Tracker** — log scores, track accuracy, subject-wise breakdown
- **Reports & Analytics** — weekly/monthly charts, test score trends, circular accuracy gauges
- **Dark Mode** — fully supported, respects system preference
- **PWA** — installable, offline-friendly via service worker

---

## Project Structure

```
VEER/
├── client/                     # React frontend
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json       # PWA manifest
│   │   └── service-worker.js   # Offline caching
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx      # App shell with sidebar
│   │   │   ├── Sidebar.jsx     # Navigation sidebar
│   │   │   ├── Navbar.jsx      # Top navbar
│   │   │   └── ProtectedRoute.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx # JWT auth state
│   │   │   └── ThemeContext.jsx# Dark/light mode
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx   # Main dashboard
│   │   │   ├── StudySession.jsx# Timer page
│   │   │   ├── Topics.jsx      # Syllabus tracker
│   │   │   ├── DailyLog.jsx    # Session log
│   │   │   ├── Tests.jsx       # Mock test scores
│   │   │   ├── Reports.jsx     # Charts & analytics
│   │   │   └── Settings.jsx
│   │   ├── utils/
│   │   │   └── api.js          # Axios API client
│   │   ├── App.jsx
│   │   ├── index.jsx
│   │   └── index.css           # Tailwind + custom utilities
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── server/                     # Node.js + Express backend
    ├── config/
    │   └── db.js               # MongoDB connection
    ├── data/
    │   ├── syllabus.js         # SSC CGL syllabus data
    │   └── seed.js             # Demo data seeder
    ├── middleware/
    │   └── auth.js             # JWT middleware
    ├── models/
    │   ├── User.js
    │   ├── Session.js
    │   ├── Topic.js
    │   └── Test.js
    ├── routes/
    │   ├── auth.js
    │   ├── sessions.js
    │   ├── topics.js
    │   ├── tests.js
    │   └── dashboard.js
    ├── server.js
    ├── .env.example
    └── package.json
```

---

## Setup Instructions

### Prerequisites

- Node.js v18+
- MongoDB (local or MongoDB Atlas)
- npm or yarn

---

### 1. Clone / navigate to the project

```bash
cd VEER
```

### 2. Setup the backend

```bash
cd server
npm install
```

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/veer
JWT_SECRET=replace_this_with_a_long_random_string
NODE_ENV=development
```

> For MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string.

**Optional — seed demo data:**

```bash
node data/seed.js
```

This creates a demo account: `demo@veer.com` / `demo123` with 14 days of sessions, topic progress, and 2 mock test results.

**Start the server:**

```bash
npm run dev     # development (nodemon)
npm start       # production
```

Server runs on `http://localhost:5000`

---

### 3. Setup the frontend

```bash
cd ../client
npm install
```

Create a `.env` file if you want a custom API URL (optional if using the built-in proxy):

```env
REACT_APP_API_URL=http://localhost:5000/api
```

**Start the client:**

```bash
npm start
```

Client runs on `http://localhost:3000` and proxies `/api` calls to port 5000.

---

### 4. Build for production

```bash
# In client/
npm run build
```

Serve the `build/` folder via any static host (Vercel, Netlify, Nginx). Point your backend to the same domain or configure CORS.

---

## API Reference

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile/settings |
| POST | `/api/sessions` | Start a study session |
| PUT | `/api/sessions/:id/stop` | Stop & save session |
| PUT | `/api/sessions/:id/pause` | Pause session |
| GET | `/api/sessions/today` | Today's sessions |
| GET | `/api/sessions` | Sessions with filters |
| GET | `/api/sessions/weekly-stats` | Last 7 days stats |
| GET | `/api/sessions/monthly-stats` | Monthly stats |
| GET | `/api/topics` | All topics + user progress |
| PUT | `/api/topics` | Update topic status |
| GET | `/api/topics/summary` | Subject completion % |
| POST | `/api/tests` | Add test result |
| GET | `/api/tests` | List test results |
| GET | `/api/tests/analytics` | Test analytics |
| DELETE | `/api/tests/:id` | Delete test |
| GET | `/api/dashboard` | Aggregated dashboard data |

---

## Database Schema

**users** — name, email, password (bcrypt), dailyGoalMinutes, streak, theme

**sessions** — user, subject, topic, startTime, endTime, durationMinutes, date, status

**topicProgress** — user, subject, topicName, status (not_started/in_progress/completed), lastStudied

**tests** — user, testName, testType, date, totalQuestions, attempted, correct, score, accuracy, subjectScores[]

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6 |
| Styling | Tailwind CSS v3 |
| Charts | Chart.js + react-chartjs-2 |
| State | React Context API |
| HTTP | Axios |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| PWA | Service Worker + Web Manifest |

---

## Demo Credentials

After running `node data/seed.js`:

- **Email:** demo@veer.com
- **Password:** demo123

---

## SSC CGL Syllabus Coverage

- **Quantitative Aptitude** — 30 topics
- **Reasoning** — 30 topics
- **English** — 27 topics
- **General Knowledge** — 23 topics

**Total: 110 topics** pre-loaded.
