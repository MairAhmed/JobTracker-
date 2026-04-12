import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const GOOGLE_CLIENT_ID = '827868551823-a0v0v9gmn81cfgdjirl8un2fc5a0sabc.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

const STATUS_CONFIG = {
  Applied:   { color: '#4A9EFF', bg: 'rgba(74,158,255,0.12)', icon: '◎' },
  Interview: { color: '#F5A623', bg: 'rgba(245,166,35,0.12)',  icon: '◈' },
  Offer:     { color: '#50E3A4', bg: 'rgba(80,227,164,0.12)',  icon: '◉' },
  Rejected:  { color: '#FF5A5A', bg: 'rgba(255,90,90,0.12)',   icon: '✕' },
};

export default function App() {
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ step: '', current: 0, total: 0 });
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('date');
  const [claudeKey, setClaudeKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Chat agent state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your job search assistant. Ask me anything about your applications — like \"how many rejections do I have?\" or \"which companies haven't responded?\"" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const claudeKeyRef = useRef("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        });
        setGapiReady(true);
      });
    };
    document.body.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.onload = () => setGisReady(true);
    document.body.appendChild(script2);
  }, []);

  useEffect(() => {
    if (!gapiReady || !gisReady) return;
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) { setError('OAuth error: ' + resp.error); return; }
        setIsSignedIn(true);
      },
    });
    setTokenClient(tc);
  }, [gapiReady, gisReady]);

  const signIn = () => {
    const key = keyInput.trim();
    if (!key) { setError('Please enter your Anthropic API key first.'); return; }
    setClaudeKey(key);
    claudeKeyRef.current = key;
    tokenClient?.requestAccessToken({ prompt: '' });
  };

  const signOut = () => {
    const token = window.gapi.client.getToken();
    if (token) window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
    setIsSignedIn(false);
    setJobs([]);
  };

  const fetchAndAnalyze = useCallback(async () => {
    const activeKey = claudeKeyRef.current || claudeKey;
    if (!activeKey) { setError('API key missing.'); return; }
    setLoading(true);
    setError('');
    setJobs([]);

    try {
      setProgress({ step: 'Searching Gmail for job emails...', current: 0, total: 0 });

      const queries = [
        'subject:(application received OR thank you for applying OR we received your application)',
        'subject:(interview OR phone screen OR technical assessment OR video interview OR hiring assessment)',
        'subject:(offer letter OR job offer OR pleased to offer OR congratulations)',
        'subject:(unfortunately OR not moving forward OR other candidates OR not selected OR decided not)',
        'subject:(your application OR application update OR application status OR application submitted)',
        'from:(workday) OR from:(myworkdayjobs.com)',
        'from:(greenhouse.io) OR from:(lever.co)',
        'from:(linkedin.com) subject:application',
        'from:(indeed.com) OR from:(ziprecruiter.com)',
        'from:(icims.com) OR from:(taleo.net) OR from:(successfactors.com)',
        'subject:(applied to OR you applied OR application for)',
        'subject:(next steps OR moving forward) (job OR role OR position OR opportunity)',
        'subject:micron application OR from:(micron.com)',
        'subject:(hiring OR recruiter) (application OR applied OR position)',
        'subject:(we have received OR confirmation) (application OR resume)',
      ];

      let allMessageIds = new Set();
      for (const q of queries) {
        let pageToken = null;
        do {
          const params = { userId: 'me', q, maxResults: 50 };
          if (pageToken) params.pageToken = pageToken;
          const res = await window.gapi.client.gmail.users.messages.list(params);
          const msgs = res.result.messages || [];
          msgs.forEach(m => allMessageIds.add(m.id));
          pageToken = res.result.nextPageToken;
        } while (pageToken && allMessageIds.size < 500);
      }

      const ids = [...allMessageIds];
      setProgress({ step: 'Fetching email content...', current: 0, total: ids.length });

      const emails = [];
      for (let i = 0; i < ids.length; i++) {
        setProgress({ step: 'Fetching email content...', current: i + 1, total: ids.length });
        try {
          const msg = await window.gapi.client.gmail.users.messages.get({
            userId: 'me', id: ids[i], format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date'],
          });
          const headers = msg.result.payload?.headers || [];
          const get = (name) => headers.find(h => h.name === name)?.value || '';
          const snippet = msg.result.snippet || '';
          emails.push({ subject: get('Subject'), from: get('From'), date: get('Date'), snippet });
        } catch (e) { /* skip */ }
      }

      setProgress({ step: 'Analyzing with Claude AI...', current: 0, total: emails.length });

      const BATCH = 15;
      const results = [];
      for (let i = 0; i < emails.length; i += BATCH) {
        setProgress({ step: 'Analyzing with Claude AI...', current: Math.min(i + BATCH, emails.length), total: emails.length });
        const batch = emails.slice(i, i + BATCH);
        const prompt = `You are an expert at analyzing job application emails. For each email, determine if it is related to a job application process. Be generous — include application confirmations, recruiter outreach, interview invites, assessments, offers, and rejections.

For each email return a JSON object with:
- "isJobEmail": true/false
- "company": the company name (infer from From domain — micron.com = Micron Technology, travelers.com = Travelers, thehartford.com = The Hartford, infosys.com = Infosys, etc.)
- "role": the job title/position (extract from subject or snippet, can be null)
- "date": date in YYYY-MM-DD format
- "status": MUST be exactly one of:
  * "Applied" — application confirmation, submission receipt, "we received your application", Workday confirmations
  * "Interview" — interview invite, phone screen, video call, technical assessment, HackerRank/Codility invite, "next steps" with scheduling
  * "Offer" — job offer, offer letter, "pleased to offer", "we'd like to offer", accepted offer
  * "Rejected" — rejection, "not moving forward", "other candidates", "unfortunately", "decided not to pursue"
  * null — if isJobEmail is false

Only include entries where isJobEmail is true AND status is not null.

Return ONLY a JSON array of ${batch.length} objects (one per email, in order). No markdown, no explanation.

EMAILS:
${batch.map((e, idx) => `[${idx}]
From: ${e.from}
Subject: ${e.subject}
Date: ${e.date}
Snippet: ${e.snippet}`).join('\n\n---\n\n')}`;

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': activeKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 2000,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          const data = await response.json();
          if (data.error) throw new Error(data.error.message);
          const text = data.content[0].text.trim().replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(text);
          parsed.forEach((item, idx) => {
            if (item?.isJobEmail && item.company && item.status) {
              results.push({ ...item, id: `${i + idx}-${Date.now()}` });
            }
          });
        } catch (e) {
          console.error('Claude batch error:', e);
        }
      }

      const STATUS_RANK = { Offer: 4, Interview: 3, Applied: 2, Rejected: 1 };
      const merged = {};
      for (const r of results) {
        const key = `${(r.company || '').toLowerCase().trim()}__${(r.role || '').toLowerCase().trim()}`;
        if (!merged[key]) {
          merged[key] = { ...r };
        } else {
          const existing = merged[key];
          if ((STATUS_RANK[r.status] || 0) > (STATUS_RANK[existing.status] || 0)) {
            merged[key].status = r.status;
          }
          if (r.date && (!existing.date || r.date > existing.date)) {
            merged[key].date = r.date;
          }
        }
      }

      const finalJobs = Object.values(merged).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setJobs(finalJobs);
      setProgress({ step: 'Done!', current: finalJobs.length, total: finalJobs.length });
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [claudeKey]);

  const exportCSV = () => {
    const header = 'Company,Role,Date,Status\n';
    const rows = filteredJobs.map(j =>
      `"${j.company || ''}","${j.role || ''}","${j.date || ''}","${j.status || ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'job-applications.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || jobs.length === 0) return;
    const activeKey = claudeKeyRef.current || claudeKey;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);

    const jobsSummary = jobs.map(j =>
      `${j.company} | ${j.role || 'N/A'} | ${j.date || 'N/A'} | ${j.status}`
    ).join('\n');

    const prompt = `You are a helpful, concise job search assistant. The user has these tracked job applications:

${jobsSummary}

Answer the user's question helpfully. Be specific with numbers and names. Keep responses short and to the point.

Question: ${userMsg}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': activeKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || 'Sorry, could not get a response.';
      setChatMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + e.message }]);
    } finally {
      setChatLoading(false);
    }
  };

  const filtered = jobs.filter(j => filter === 'All' || j.status === filter);
  const searched = filtered.filter(j => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (j.company || '').toLowerCase().includes(q) || (j.role || '').toLowerCase().includes(q);
  });
  const filteredJobs = [...searched].sort((a, b) => {
    if (sortBy === 'date') return (b.date || '').localeCompare(a.date || '');
    if (sortBy === 'company') return (a.company || '').localeCompare(b.company || '');
    if (sortBy === 'status') return (b.status || '').localeCompare(a.status || '');
    return 0;
  });

  const counts = jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {});

  return (
    <div className="app">
      <div className="noise" />

      <header className="header">
        <div className="header-left">
          <div className="logo-mark">JT</div>
          <div>
            <h1 className="app-title">Job Tracker</h1>
            <p className="app-sub">AI-powered application intelligence</p>
          </div>
        </div>
        {isSignedIn && (
          <button className="btn btn-ghost" onClick={signOut}>Sign Out</button>
        )}
      </header>

      {!isSignedIn ? (
        <div className="landing">
          <div className="landing-content">
            <div className="hero-badge">POWERED BY CLAUDE AI</div>
            <h2 className="hero-title">Your inbox.<br/>Your career.<br/><span className="accent">Organized.</span></h2>
            <p className="hero-desc">Connect your Gmail and let Claude AI scan your emails, extract every job application, and build you a live tracker — automatically.</p>

            <div className="setup-card">
              <label className="input-label">Anthropic API Key</label>
              <div className="input-row">
                <input
                  type="password"
                  className="text-input"
                  placeholder="sk-ant-..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                />
              </div>
              <p className="input-hint">Your key is used only in-browser and never stored.</p>
              <button
                className="btn btn-primary"
                onClick={signIn}
                disabled={!gapiReady || !gisReady || !keyInput.trim()}
              >
                {(!gapiReady || !gisReady) ? 'Loading...' : 'Connect Gmail →'}
              </button>
              {error && <p className="error-msg">{error}</p>}
            </div>

            <div className="features">
              {[
                ['◎', 'Detects Applications', 'Finds confirmation emails across all companies'],
                ['◈', 'Tracks Interviews', 'Identifies scheduling and assessment emails'],
                ['✕', 'Catches Rejections', 'Spots the "unfortunately" emails you dread'],
                ['◆', 'AI Chat Agent', 'Ask questions about your job search in plain English'],
              ].map(([icon, title, desc]) => (
                <div className="feature" key={title}>
                  <span className="feature-icon">{icon}</span>
                  <strong>{title}</strong>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard">
          {jobs.length === 0 && !loading && (
            <div className="scan-prompt">
              <div className="scan-icon">⟳</div>
              <h3>Ready to scan your inbox</h3>
              <p>Claude will search your Gmail for job-related emails and build your tracker.</p>
              <button className="btn btn-primary" onClick={fetchAndAnalyze}>
                Scan Emails with AI
              </button>
            </div>
          )}

          {loading && (
            <div className="loading-card">
              <div className="spinner" />
              <p className="loading-step">{progress.step}</p>
              {progress.total > 0 && (
                <>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                  </div>
                  <p className="progress-text">{progress.current} / {progress.total}</p>
                </>
              )}
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}

          {jobs.length > 0 && (
            <>
              <div className="stats-row">
                <div className="stat-card total">
                  <span className="stat-num">{jobs.length}</span>
                  <span className="stat-label">Total Applications</span>
                </div>
                {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                  counts[status] ? (
                    <div className="stat-card" key={status} style={{ borderColor: cfg.color }}>
                      <span className="stat-num" style={{ color: cfg.color }}>{counts[status]}</span>
                      <span className="stat-label">{status}</span>
                    </div>
                  ) : null
                ))}
              </div>

              <div className="toolbar">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search company or role..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <div className="filter-chips">
                  {['All', ...Object.keys(STATUS_CONFIG)].map(f => (
                    <button
                      key={f}
                      className={`chip ${filter === f ? 'active' : ''}`}
                      style={filter === f && f !== 'All' ? { background: STATUS_CONFIG[f]?.bg, color: STATUS_CONFIG[f]?.color, borderColor: STATUS_CONFIG[f]?.color } : {}}
                      onClick={() => setFilter(f)}
                    >
                      {f !== 'All' && STATUS_CONFIG[f]?.icon + ' '}{f}
                    </button>
                  ))}
                </div>
                <div className="toolbar-right">
                  <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="date">Sort: Date</option>
                    <option value="company">Sort: Company</option>
                    <option value="status">Sort: Status</option>
                  </select>
                  <button className="btn btn-outline" onClick={exportCSV}>⬇ Export CSV</button>
                  <button className="btn btn-ghost" onClick={fetchAndAnalyze}>↺ Rescan</button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="jobs-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Company</th>
                      <th>Role</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job, idx) => {
                      const cfg = STATUS_CONFIG[job.status];
                      if (!cfg) return null;
                      return (
                        <tr key={job.id} className="job-row">
                          <td className="row-num">{idx + 1}</td>
                          <td className="company-cell">{job.company || '—'}</td>
                          <td className="role-cell">{job.role || '—'}</td>
                          <td className="date-cell">{job.date || '—'}</td>
                          <td>
                            <span className="status-badge" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.color }}>
                              {cfg.icon} {job.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredJobs.length === 0 && (
                  <div className="empty-state">No applications match this filter.</div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* AI Chat Agent */}
      {isSignedIn && jobs.length > 0 && (
        <>
          <button className="chat-fab" onClick={() => setChatOpen(o => !o)}>
            {chatOpen ? '✕' : '◆'}
            {!chatOpen && <span className="chat-fab-label">Ask AI</span>}
          </button>

          {chatOpen && (
            <div className="chat-panel">
              <div className="chat-header">
                <div className="chat-header-left">
                  <div className="chat-avatar">◆</div>
                  <div>
                    <div className="chat-title">Job Search Assistant</div>
                    <div className="chat-sub">Analyzing {jobs.length} applications</div>
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => setChatOpen(false)}>✕</button>
              </div>

              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}>
                    <div className="chat-bubble">{msg.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-msg assistant">
                    <div className="chat-bubble chat-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-suggestions">
                {['How many rejections?', 'Any pending interviews?', 'Which applied most recently?'].map(s => (
                  <button key={s} className="suggestion-chip" onClick={() => setChatInput(s)}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="chat-input-row">
                <input
                  className="chat-input"
                  placeholder="Ask about your applications..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                />
                <button className="chat-send" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                  →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
