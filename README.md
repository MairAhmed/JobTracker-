# JobTracker AI 🎯

An AI-powered job application tracker that automatically scans your Gmail inbox, extracts every job application, and organizes them into a fully-featured live dashboard — powered by Claude AI.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react) ![Claude AI](https://img.shields.io/badge/Claude-Haiku-orange?style=flat) ![Gmail API](https://img.shields.io/badge/Gmail-API-red?style=flat&logo=gmail) ![License](https://img.shields.io/badge/License-MIT-green?style=flat)

---

## What It Does

Most job seekers apply to dozens of companies across Workday, LinkedIn, Greenhouse, Lever, and more — and quickly lose track. JobTracker AI solves this by:

- **Scanning your Gmail** across 40+ targeted query patterns covering every major ATS and job board
- **Using Claude AI** to semantically understand each email — extracting company, role, date, and status with no brittle regex rules
- **Building a live tracker** with three views: Table, Kanban Board, and Analytics
- **Keeping everything local** — your API key and email data never leave your browser

---

## Features

### Core Tracking
| Feature | Description |
|---|---|
| 🔍 Gmail Scan | 40+ query patterns covering Workday, Greenhouse, Lever, iCIMS, Taleo, Ashby, Jobvite, LinkedIn, Indeed, and more |
| 🤖 Claude AI Parsing | Strict classification — filters out job alerts and newsletters, extracts real company names from ATS senders, aggressively extracts role titles |
| 📊 Status Tracking | Classifies each application as Applied, Interview, Offer, or Rejected |
| 🔄 Smart Deduplication | Merges emails from the same company+role, keeps highest status; preserves separate entries for null-role jobs by date |
| 💾 Local Persistence | All jobs auto-save to localStorage — survive page refreshes without rescanning |
| ✍️ Manual Entry | Add jobs that slipped through email scanning via a full form modal |

### Views
| View | Description |
|---|---|
| ☰ Table | Sortable, filterable, searchable list with inline status editing and follow-up date tracking |
| ⊞ Kanban Board | Drag-and-drop cards between Applied / Interview / Offer / Rejected columns with per-card prep progress bars |
| ◈ Analytics | Donut chart, key metrics, monthly activity bar chart, GitHub-style heatmap, application funnel, and salary comparison |

### Job Detail Panel
Click any row or card to open a slide-in panel with:
- Editable status, dates, salary range, and job URL
- Free-form notes field
- **Interview Prep Mode** — unlocks when status is Interview or Offer: interviewer name, interview date/time, prep notes, and a 7-item prep checklist that persists per job
- **Activity Timeline** — chronological log of every status change with timestamps
- **Company Quick-links** — one-click to Google, LinkedIn, Glassdoor, and Levels.fyi

### Analytics Dashboard
- **Breakdown donut chart** — visual split of Applied / Interview / Offer / Rejected
- **6 key metrics** — total, response rate, offer rate, interviews, rejections, overdue follow-ups
- **Monthly activity bar chart** — applications per month over the last 10 months
- **Activity heatmap** — GitHub-style calendar showing application intensity over the last 6 months
- **Application funnel** — Applied → Interview → Offer conversion rates
- **Salary comparison chart** — horizontal bars for every job with a salary range entered

### Productivity
| Feature | Description |
|---|---|
| 🗓 Follow-up Reminders | Set a follow-up date per job; overdue entries glow red in the table and Kanban, plus a stat card shows the total overdue count |
| 🎯 Weekly Goal Tracker | Set a weekly application target; a circular progress ring in the stats row tracks this week's count vs. goal |
| 💬 Smart AI Chat | Ask plain-English questions about your search; suggestions update dynamically based on your real data |
| ⬇️ CSV Export | Download the full tracker (including salary, URL, notes, follow-up dates) as a spreadsheet |
| ☀ Light / Dark Mode | Theme toggle in the header, preference saved to localStorage |

### Polish
| Feature | Description |
|---|---|
| 🎊 Offer Confetti | Canvas-based confetti burst fires whenever any job reaches Offer status |
| ↑ Animated Counters | Stat card numbers count up with a cubic ease-out whenever values change |
| ✓ Toast Notifications | Slide-up toasts confirm every action — add, delete (with Undo), status changes, scan complete |

---

## Tech Stack

- **Frontend:** React 18 (single-file, no routing library)
- **AI:** Anthropic Claude API (`claude-haiku-4-5-20251001`)
- **Email:** Gmail API (Google OAuth 2.0, read-only)
- **Auth:** Google Identity Services (GIS)
- **Storage:** Browser localStorage (no backend)
- **Styling:** Custom CSS with CSS variables and dark/light theming

---

## Getting Started

### Prerequisites

- Node.js 16+
- An [Anthropic API key](https://console.anthropic.com)
- A Google Cloud project with Gmail API enabled

### Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project
2. Enable the **Gmail API** under APIs & Services → Library
3. Go to **Google Auth Platform** → Get Started → set Audience to **External**
4. Add your Gmail as a **test user** under Audience → Test Users
5. Go to **Credentials** → Create Credentials → **OAuth Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3001`
   - Authorized redirect URIs: `http://localhost:3001`
6. Copy the **Client ID** and paste it into `src/App.js` line 4

### Installation

```bash
# Clone the repo
git clone https://github.com/MairAhmed/JobTracker-.git
cd JobTracker-

# Install dependencies
npm install

# Start the app
npm start
```

The app runs at `http://localhost:3001`

---

## How It Works

```
Gmail Inbox
    ↓
Gmail API (OAuth, read-only)
  40+ query patterns — fetches up to 600 job-related email IDs
    ↓
Email metadata fetch — Subject, From, Date, Snippet (no body content)
    ↓
Claude Haiku — batches of 12 emails, extracts per email:
  • Company name (from subject/snippet, NOT inferred from ATS domain)
  • Job title / role (7 extraction patterns)
  • Application date (YYYY-MM-DD)
  • Status: Applied | Interview | Offer | Rejected
  • Strict filter: excludes job alerts, newsletters, recruiter outreach
    ↓
Smart Deduplication Engine
  • Same company + role → merge, keep highest status, latest date
  • Null role → deduplicate by company + date (preserves multiple apps to same company)
  • Role promotion: if a later email reveals the role for a previously null entry, it gets promoted
    ↓
Live Dashboard
  • Table / Kanban / Analytics views
  • Follow-up reminders, weekly goal, activity heatmap
    ↓
AI Chat Agent — Claude answers questions using your tracker as context
```

### Status Classification

| Status | Trigger Examples |
|---|---|
| **Applied** | Application confirmation, Workday receipt, "we received your application", "thank you for applying" |
| **Interview** | Phone screen invite, video interview request, technical assessment, HackerRank/Codility link, scheduling email |
| **Offer** | Offer letter, "pleased to offer", "we'd like to offer you", verbal offer confirmation |
| **Rejected** | "Unfortunately", "not moving forward", "decided to pursue other candidates", "not selected" |

### ATS Coverage

The scanner specifically targets emails from: Workday · Greenhouse · Lever · iCIMS · Taleo · SuccessFactors · SmartRecruiters · Jobvite · Ashby · BrassRing · LinkedIn · Indeed · ZipRecruiter — plus broad subject-line patterns that catch any ATS not in this list.

---

## Usage

1. Open the app and paste your **Anthropic API key** (stays in your browser only)
2. Click **Connect Gmail** and authorize with your Google account
3. Click **Scan Emails with AI** — Claude will analyze up to 600 emails
4. Switch between **Table**, **Board**, and **Analytics** views using the header toggle
5. Click any row or card to open the **detail panel** — add notes, salary, follow-up dates
6. Drag Kanban cards between columns to update status
7. Open **◈ Analytics** for charts, heatmap, and salary comparison
8. Click **◆ Ask AI** to chat with your job search assistant
9. Hit **⬇ CSV** to download your data

---

## AI Chat Examples

> *"How many rejections do I have?"*
> *"Which companies have I interviewed with?"*
> *"I have 3 overdue follow-ups — who are they?"*
> *"What's my response rate this month?"*
> *"Which applications should I follow up on?"*
> *"How should I evaluate my offer from Google?"*

---

## Privacy & Security

- Your Anthropic API key is entered in the browser and **never sent to any server other than Anthropic's API**
- Gmail access is **read-only** — the app cannot send, delete, or modify any emails
- Only email **metadata** is read (Subject, From, Date, Snippet) — email body content is never fetched
- All job data is stored in **browser localStorage only** — nothing is sent to any external server
- OAuth tokens are revoked on Sign Out

---

## Project Structure

```
src/
├── App.js          — All components and logic in a single file
│   ├── launchConfetti()        — Canvas-based confetti animation
│   ├── AnimatedNumber          — Counting number component
│   ├── ToastContainer          — Slide-up notification system
│   ├── DonutChart              — SVG status breakdown chart
│   ├── BarChart                — Monthly activity chart
│   ├── ActivityHeatmap         — GitHub-style calendar heatmap
│   ├── WeeklyGoalWidget        — Circular progress ring
│   ├── SalaryChart             — Horizontal salary comparison bars
│   ├── AddJobModal             — Manual job entry form
│   ├── JobDetailPanel          — Slide-in detail/edit panel
│   ├── KanbanBoard             — Drag-and-drop board view
│   ├── AnalyticsView           — Full analytics dashboard
│   └── App                     — Main component with all state
└── App.css         — Full styling with dark/light CSS variables
```

---

## License

MIT — feel free to fork, extend, and build on this.

---

*Built with React + Claude AI + Gmail API*
