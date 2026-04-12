# JobTracker AI 🎯

An AI-powered job application tracker that automatically scans your Gmail inbox, extracts every job application, and organizes them into a live dashboard — powered by Claude AI.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react) ![Claude AI](https://img.shields.io/badge/Claude-Haiku-orange?style=flat) ![Gmail API](https://img.shields.io/badge/Gmail-API-red?style=flat&logo=gmail) ![License](https://img.shields.io/badge/License-MIT-green?style=flat)

---

## What It Does

Most job seekers apply to dozens of companies across Workday, LinkedIn, Greenhouse, Lever, and more — and quickly lose track. JobTracker AI solves this by:

- **Scanning your Gmail** for job-related emails using the Gmail API
- **Using Claude AI** to semantically understand each email and extract structured data — no brittle regex rules
- **Building a live tracker** with company, role, date, and application status
- **Deduplicating** entries so each company+role shows only its highest status
- **Exporting to CSV** so you can take your data anywhere
- **AI Chat Agent** — ask plain-English questions about your job search

---

## Features

| Feature | Description |
|---|---|
| 🔍 Gmail Scan | Searches across 15+ query patterns covering Workday, Greenhouse, Lever, LinkedIn, Indeed, iCIMS, Taleo and more |
| 🤖 Claude AI Parsing | Extracts company, role, date, and status from unstructured email text |
| 📊 Status Tracking | Classifies each application as Applied, Interview, Offer, or Rejected |
| 🔄 Smart Deduplication | Merges emails from the same company+role, keeping the highest status |
| 💬 AI Chat Agent | Ask questions like "how many rejections?" or "which interviews are pending?" |
| ⬇️ CSV Export | Download your full tracker as a spreadsheet |
| 🔒 Privacy First | Your API key and email data never leave your browser |

---

## Tech Stack

- **Frontend:** React 18
- **AI:** Anthropic Claude API (Haiku model)
- **Email:** Gmail API (Google OAuth 2.0)
- **Auth:** Google Identity Services (GIS)
- **Styling:** Custom CSS with CSS variables

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
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3001`
   - Authorized redirect URIs: `http://localhost:3001`
6. Copy the **Client ID**

### Installation

```bash
# Clone the repo
git clone https://github.com/MairAhmed/JobTracker-.git
cd JobTracker-

# Install dependencies
npm install

# Add your Google OAuth Client ID
# Open src/App.js and replace line 4:
# const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';

# Start the app
npm start
```

The app runs at `http://localhost:3001`

---

## How It Works

```
Gmail Inbox
    ↓
Gmail API (OAuth) — fetches up to 500 job-related emails
    ↓
Claude Haiku — batches of 15 emails, extracts:
  • Company name (inferred from sender domain)
  • Job title / role
  • Application date
  • Status: Applied | Interview | Offer | Rejected
    ↓
Deduplication Engine — merges same company+role, keeps highest status
    ↓
Live Dashboard — filter, search, sort, export CSV
    ↓
AI Chat Agent — Claude answers questions about your tracker
```

### Status Classification

| Status | Trigger Examples |
|---|---|
| **Applied** | Application confirmation, Workday receipt, "we received your application" |
| **Interview** | Phone screen invite, technical assessment, HackerRank/Codility link, scheduling email |
| **Offer** | Offer letter, "pleased to offer", accepted offer confirmation |
| **Rejected** | "Unfortunately", "not moving forward", "other candidates", "decided not to pursue" |

---

## Usage

1. Open the app and paste your **Anthropic API key** (stays in your browser only)
2. Click **Connect Gmail** and authorize with your Google account
3. Click **Scan Emails with AI** — Claude will scan up to 500 emails
4. Browse your tracker, filter by status, search by company
5. Click **◆ Ask AI** to chat with your job search assistant
6. Hit **⬇ Export CSV** to download your data

---

## AI Chat Agent Examples

> *"How many rejections do I have?"*
> *"Which companies have I interviewed with?"*
> *"What's my most recent application?"*
> *"Which applications are still waiting for a response?"*
> *"How many total applications did I submit this month?"*

---

## Privacy & Security

- Your Anthropic API key is entered in the browser and **never sent to any server other than Anthropic's API**
- Gmail access is **read-only** — the app cannot send, delete, or modify any emails
- No data is stored, logged, or persisted anywhere — everything lives in browser memory for the session
- OAuth tokens are revoked on Sign Out

---

## License

MIT — feel free to fork, extend, and build on this.

---

*Built with React + Claude AI + Gmail API*
