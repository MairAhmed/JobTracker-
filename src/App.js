import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';

const GOOGLE_CLIENT_ID = '827868551823-a0v0v9gmn81cfgdjirl8un2fc5a0sabc.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

const STATUS_CONFIG = {
  Applied:   { color: '#4A9EFF', bg: 'rgba(74,158,255,0.12)',  icon: '◎' },
  Interview: { color: '#F5A623', bg: 'rgba(245,166,35,0.12)',  icon: '◈' },
  Offer:     { color: '#50E3A4', bg: 'rgba(80,227,164,0.12)',  icon: '◉' },
  Rejected:  { color: '#FF5A5A', bg: 'rgba(255,90,90,0.12)',   icon: '✕' },
};
const STATUSES = Object.keys(STATUS_CONFIG);

const PREP_ITEMS = [
  'Research the company — mission, products, recent news',
  'Review the job description and map your experience to it',
  'Prepare 3–5 STAR method stories for behavioural questions',
  'Prepare thoughtful questions to ask the interviewer',
  'Know your salary expectations and walk-away number',
  'Test audio/video setup if the interview is virtual',
  'Confirm the interview time, format, and interviewer name',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getSmartSuggestions(jobs) {
  const suggestions = [];
  const counts = jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {});
  const today = new Date().toISOString().split('T')[0];
  const overdue = jobs.filter(j => j.followUpDate && j.followUpDate <= today && j.status !== 'Rejected');
  if (overdue.length > 0) suggestions.push(`I have ${overdue.length} overdue follow-up${overdue.length > 1 ? 's' : ''}`);
  if (counts.Interview > 0) suggestions.push(`Tips for my ${counts.Interview} upcoming interview${counts.Interview > 1 ? 's' : ''}?`);
  if (counts.Offer > 0) suggestions.push('How should I evaluate my offers?');
  if (counts.Rejected > 3) suggestions.push('Why might I keep getting rejected?');
  if (counts.Applied > 5) suggestions.push('Which applications should I follow up on?');
  suggestions.push('What is my overall response rate?');
  suggestions.push('Which companies are most promising?');
  return suggestions.slice(0, 3);
}

function parseSalary(str) {
  if (!str) return null;
  const matches = [...str.toLowerCase().matchAll(/(\d[\d,]*)(\s*k)?/g)];
  const nums = matches.map(m => {
    const n = parseInt(m[1].replace(/,/g, ''));
    if (!n) return null;
    const val = (m[2] && m[2].trim() === 'k') ? n * 1000 : n;
    return val > 100 && val < 10000000 ? val : null;
  }).filter(Boolean);
  if (nums.length === 0) return null;
  if (nums.length === 1) return { low: nums[0], high: nums[0] };
  return { low: Math.min(...nums), high: Math.max(...nums) };
}

function fmtSalary(n) { return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`; }

// ── Role extraction from URL slug ─────────────────────────────────────────────
function extractRoleFromUrl(url) {
  if (!url || url.length < 10) return null;
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    const noise = new Set(['jobs','careers','apply','application','positions','openings','job','posting','view','req','jobid','requisition','en','us','en-us','en-gb','gb','in','job-detail','details','detail','search','results','listing','listings','external','public']);
    const candidates = segments.filter(s =>
      s.length > 5 &&
      !/^[\d]+$/.test(s) &&         // skip pure number segments
      !noise.has(s.toLowerCase()) &&
      s.includes('-')                // slug-style segments have hyphens
    );
    if (candidates.length === 0) return null;
    // Prefer the segment with the most words (hyphens)
    const best = candidates.sort((a, b) => b.split('-').length - a.split('-').length)[0];
    // Strip trailing year or numeric IDs like -2026, -R12345
    const cleaned = best.replace(/[-_][Rr]?\d{3,}$/, '').replace(/-+$/, '');
    const words = cleaned.split('-').filter(w => w.length > 0);
    if (words.length < 2) return null;
    // Title-case each word
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  } catch(e) {
    return null;
  }
}

function getThisWeekRange() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const mon = new Date(today); mon.setDate(today.getDate() - daysFromMon);
  const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().split('T')[0], sun.toISOString().split('T')[0]];
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function launchConfetti() {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position:'fixed', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'9999' });
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const COLORS = ['#4A9EFF','#50E3A4','#F5A623','#FF5A5A','#ffffff','#c084fc','#f472b6'];
  const particles = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: canvas.height * -0.1 - Math.random() * 120,
    w: Math.random() * 11 + 5,
    h: Math.random() * 5  + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 7,
    vy: Math.random() * 4 + 1.5,
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 12,
    opacity: 1,
  }));
  let frame = 0;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.rotV;
      if (frame > 55) p.opacity = Math.max(0, p.opacity - 0.018);
      if (p.opacity > 0) alive = true;
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle   = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 180) requestAnimationFrame(tick);
    else document.body.removeChild(canvas);
  };
  requestAnimationFrame(tick);
}

// ── Animated Number ───────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 700 }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef  = useRef(null);
  useEffect(() => {
    const from = prevRef.current, to = value;
    if (from === to) return;
    const start = performance.now();
    const tick  = now => {
      const t    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * ease));
      if (t < 1) { rafRef.current = requestAnimationFrame(tick); }
      else        { prevRef.current = to; }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);
  return <>{display}</>;
}

// ── Toast Container ───────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-msg">{t.message}</span>
          {t.action && (
            <button className="toast-action-btn" onClick={() => { t.action(); onRemove(t.id); }}>
              {t.actionLabel}
            </button>
          )}
          <button className="toast-close" onClick={() => onRemove(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ counts }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const present = STATUSES.filter(s => counts[s] > 0);
  const cx = 70, cy = 70, r = 52, innerR = 33;
  const toRad = d => (d * Math.PI) / 180;
  let cumAngle = -90;
  const slices = present.map(status => {
    const pct = counts[status] / total;
    const isFull = pct >= 0.9999;
    const angle = isFull ? 359.9 : pct * 360;
    const sa = cumAngle, ea = cumAngle + angle; cumAngle = ea;
    if (isFull) return { status, full: true, color: STATUS_CONFIG[status].color };
    const largeArc = angle > 180 ? 1 : 0;
    const ox1 = cx + r * Math.cos(toRad(sa)), oy1 = cy + r * Math.sin(toRad(sa));
    const ox2 = cx + r * Math.cos(toRad(ea)), oy2 = cy + r * Math.sin(toRad(ea));
    const ix1 = cx + innerR * Math.cos(toRad(sa)), iy1 = cy + innerR * Math.sin(toRad(sa));
    const ix2 = cx + innerR * Math.cos(toRad(ea)), iy2 = cy + innerR * Math.sin(toRad(ea));
    return { status, full: false, color: STATUS_CONFIG[status].color, d: `M ${ox1} ${oy1} A ${r} ${r} 0 ${largeArc} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z` };
  });
  return (
    <div className="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {slices.map(s => s.full
          ? <g key={s.status}><circle cx={cx} cy={cy} r={r} fill={s.color} opacity="0.9"/><circle cx={cx} cy={cy} r={innerR} fill="var(--surface)"/></g>
          : <path key={s.status} d={s.d} fill={s.color} opacity="0.9"/>)}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text)" fontSize="22" fontWeight="800" fontFamily="Syne,sans-serif">{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fill="var(--text2)" fontSize="9" fontFamily="DM Mono,monospace" letterSpacing="1">APPS</text>
      </svg>
      <div className="donut-legend">
        {present.map(s => (
          <div key={s} className="legend-item">
            <span className="legend-dot" style={{ background: STATUS_CONFIG[s].color }}/>
            <span className="legend-label">{s}</span>
            <span className="legend-val">{counts[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ byMonth }) {
  const months = Object.keys(byMonth).sort().slice(-10);
  if (months.length === 0) return <div className="chart-empty">No timeline data yet</div>;
  const max = Math.max(...months.map(m => byMonth[m]), 1);
  return (
    <div className="bar-chart">
      {months.map(month => {
        const val = byMonth[month];
        return (
          <div key={month} className="bar-col">
            <div className="bar-val">{val}</div>
            <div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max((val / max) * 100, 4)}%` }}/></div>
            <div className="bar-label">{new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Activity Heatmap ──────────────────────────────────────────────────────────
function ActivityHeatmap({ jobs }) {
  const dateCounts = useMemo(() => {
    const m = {};
    jobs.forEach(j => { if (j.date) m[j.date] = (m[j.date] || 0) + 1; });
    return m;
  }, [jobs]);

  const todayStr = new Date().toISOString().split('T')[0];
  const WEEKS = 26;

  const weeks = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7); // go back to Sunday
    const result = [];
    const cursor = new Date(start);
    for (let w = 0; w < WEEKS; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const ds = cursor.toISOString().split('T')[0];
        week.push({ date: ds, count: dateCounts[ds] || 0, future: ds > todayStr });
        cursor.setDate(cursor.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [dateCounts, todayStr]);

  const monthLabels = useMemo(() => {
    const labels = []; let last = '';
    weeks.forEach((week, wi) => {
      const lbl = new Date(week[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });
      if (lbl !== last) { labels.push({ lbl, wi }); last = lbl; }
    });
    return labels;
  }, [weeks]);

  const colorFor = count => {
    if (count === 0) return 'var(--surface2)';
    if (count === 1) return 'rgba(74,158,255,0.35)';
    if (count === 2) return 'rgba(74,158,255,0.6)';
    if (count === 3) return 'rgba(74,158,255,0.8)';
    return '#4A9EFF';
  };

  const total = Object.values(dateCounts).reduce((s, v) => s + v, 0);

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-month-row">
        {monthLabels.map(({ lbl, wi }) => (
          <span key={`${lbl}-${wi}`} style={{ left: wi * 14 + 'px' }}>{lbl}</span>
        ))}
      </div>
      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="heatmap-week">
            {week.map(day => (
              <div key={day.date} className="heatmap-day"
                style={{ background: day.future ? 'transparent' : colorFor(day.count), border: day.future ? '1px solid var(--border)' : 'none', opacity: day.future ? 0.3 : 1 }}
                title={day.count > 0 ? `${day.date}: ${day.count} application${day.count > 1 ? 's' : ''}` : day.date}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-footer">
        <span className="heatmap-legend-label">Less</span>
        {[0,1,2,3,4].map(n => <div key={n} className="heatmap-day heatmap-legend-swatch" style={{ background: colorFor(n) }}/>)}
        <span className="heatmap-legend-label">More</span>
        <span className="heatmap-total">{total} applications in the last 6 months</span>
      </div>
    </div>
  );
}

// ── Weekly Goal Widget ────────────────────────────────────────────────────────
function WeeklyGoalWidget({ jobs, goal, onChangeGoal }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput]     = useState(String(goal));

  const [monStr, sunStr] = getThisWeekRange();
  const thisWeek = jobs.filter(j => j.date && j.date >= monStr && j.date <= sunStr).length;
  const pct = Math.min(thisWeek / goal, 1);
  const r = 18, circ = 2 * Math.PI * r;
  const done = thisWeek >= goal;

  const save = () => {
    const n = parseInt(input);
    if (n > 0) onChangeGoal(n);
    setEditing(false);
  };

  return (
    <div className={`stat-card goal-card ${done ? 'goal-done' : ''}`} style={{ borderColor: done ? '#50E3A4' : undefined }}>
      {editing ? (
        <div className="goal-edit-row">
          <span className="stat-label" style={{ marginBottom: 0 }}>Weekly goal</span>
          <input className="goal-input" type="number" min="1" max="100" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus />
          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={save}>Set</button>
        </div>
      ) : (
        <div className="goal-display" onClick={() => { setInput(String(goal)); setEditing(true); }} title="Click to change goal">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border2)" strokeWidth="3"/>
            <circle cx="22" cy="22" r={r} fill="none"
              stroke={done ? '#50E3A4' : '#4A9EFF'} strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
              strokeLinecap="round" transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}/>
            <text x="22" y="26" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--text)" fontFamily="Syne,sans-serif">{thisWeek}</text>
          </svg>
          <div>
            <div className="stat-num" style={{ color: done ? '#50E3A4' : 'var(--text)', fontSize: '15px', lineHeight: 1.1 }}>
              {thisWeek}<span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400 }}>/{goal}</span>
            </div>
            <div className="stat-label">This week {done ? '✓' : ''}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Salary Chart ──────────────────────────────────────────────────────────────
function SalaryChart({ jobs }) {
  const rows = useMemo(() => {
    return jobs
      .filter(j => j.salary && j.salary.trim())
      .map(j => ({ ...j, parsed: parseSalary(j.salary) }))
      .filter(j => j.parsed)
      .sort((a, b) => b.parsed.high - a.parsed.high);
  }, [jobs]);

  if (rows.length === 0) return (
    <div className="chart-empty">No salary data yet — add salary ranges (e.g. "$90k–$120k") via the job detail panel.</div>
  );

  const maxVal = Math.max(...rows.map(j => j.parsed.high), 1);

  return (
    <div className="salary-chart">
      {rows.map(j => {
        const cfg = STATUS_CONFIG[j.status] || STATUS_CONFIG.Applied;
        const lowPct  = (j.parsed.low  / maxVal) * 100;
        const highPct = (j.parsed.high / maxVal) * 100;
        const label   = j.parsed.low === j.parsed.high
          ? fmtSalary(j.parsed.low)
          : `${fmtSalary(j.parsed.low)}–${fmtSalary(j.parsed.high)}`;
        return (
          <div key={j.id} className="salary-row">
            <div className="salary-name">{j.company}{j.role ? ` · ${j.role}` : ''}</div>
            <div className="salary-bar-wrap">
              <div className="salary-bar-track">
                <div className="salary-bar-fill" style={{ left: `${lowPct}%`, width: `${Math.max(highPct - lowPct, 1)}%`, background: cfg.color }}/>
              </div>
              <span className="salary-val" style={{ color: cfg.color }}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Add Job Modal ─────────────────────────────────────────────────────────────
function AddJobModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    company: '', role: '', status: 'Applied',
    date: new Date().toISOString().split('T')[0],
    url: '', salary: '', notes: '', followUpDate: '',
  });
  const up = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const handleSubmit = e => {
    e.preventDefault();
    if (!form.company.trim()) return;
    const ts = new Date().toISOString();
    onAdd({ ...form, id: `manual-${Date.now()}`, activity: [{ ts, type: 'created', from: null, to: form.status }], prepChecked: [], interviewerName: '', interviewDate: '', prepNotes: '' });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Application</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label>Company *</label><input className="text-input" value={form.company} onChange={up('company')} placeholder="e.g. Google" required autoFocus/></div>
            <div className="form-group"><label>Role</label><input className="text-input" value={form.role} onChange={up('role')} placeholder="e.g. Software Engineer"/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Status</label><select className="text-input" value={form.status} onChange={up('status')}>{STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].icon} {s}</option>)}</select></div>
            <div className="form-group"><label>Date Applied</label><input className="text-input" type="date" value={form.date} onChange={up('date')}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Salary Range</label><input className="text-input" value={form.salary} onChange={up('salary')} placeholder="e.g. $90k–$120k"/></div>
            <div className="form-group"><label>Follow-up Date</label><input className="text-input" type="date" value={form.followUpDate} onChange={up('followUpDate')}/></div>
          </div>
          <div className="form-group"><label>Job URL</label><input className="text-input" value={form.url} onChange={up('url')} placeholder="https://..."/></div>
          <div className="form-group"><label>Notes</label><textarea className="text-input text-area" value={form.notes} onChange={up('notes')} placeholder="Recruiter name, interview notes, impressions…" rows={3}/></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Application</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Job Detail Panel ──────────────────────────────────────────────────────────
function JobDetailPanel({ job, onClose, onUpdate, onDelete }) {
  const [form, setForm] = useState({ ...job });
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = form.followUpDate && form.followUpDate <= today && form.status !== 'Rejected';
  const isInterview = form.status === 'Interview' || form.status === 'Offer';

  const up = k => e => {
    const val = e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    onUpdate(job.id, { [k]: val });
  };
  const upDirect = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    onUpdate(job.id, { [k]: v });
  };

  const togglePrep = idx => {
    const current = form.prepChecked || [];
    const next = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx];
    upDirect('prepChecked', next);
  };

  const cfg = STATUS_CONFIG[form.status] || STATUS_CONFIG.Applied;
  const activity = [...(form.activity || [])].reverse();

  const companySlug = encodeURIComponent(form.company || '');

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-header-info">
          <div className="detail-company">{form.company || '—'}</div>
          <div className="detail-role">{form.role || 'No role specified'}</div>
          {/* Company quick-links */}
          <div className="quick-links">
            <a className="quick-link" href={`https://www.google.com/search?q=${companySlug}+company`} target="_blank" rel="noreferrer" title="Google">G</a>
            <a className="quick-link" href={`https://www.linkedin.com/company/${form.company?.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}`} target="_blank" rel="noreferrer" title="LinkedIn">in</a>
            <a className="quick-link" href={`https://www.glassdoor.com/Search/results.htm?keyword=${companySlug}`} target="_blank" rel="noreferrer" title="Glassdoor">GD</a>
            <a className="quick-link" href={`https://www.levels.fyi/companies/${companySlug}`} target="_blank" rel="noreferrer" title="Levels.fyi">LV</a>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>

      <div className="detail-body">
        {/* Status */}
        <div className="detail-section">
          <label className="detail-label">Status</label>
          <select className="status-select-panel" value={form.status} onChange={up('status')} style={{ color: cfg.color, borderColor: cfg.color, background: cfg.bg }}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].icon} {s}</option>)}
          </select>
        </div>

        {/* Role */}
        <div className="detail-section">
          <label className="detail-label">
            Role / Position
            {!form.role && <span className="role-hint"> — paste the job URL below to auto-fill</span>}
          </label>
          <input className="text-input sm" value={form.role || ''} onChange={up('role')} placeholder="e.g. Software Engineer Intern"/>
        </div>

        {/* Dates */}
        <div className="detail-2col">
          <div className="detail-section">
            <label className="detail-label">Date Applied</label>
            <input className="text-input sm" type="date" value={form.date || ''} onChange={up('date')}/>
          </div>
          <div className="detail-section">
            <label className="detail-label" style={isOverdue ? { color: '#FF5A5A' } : {}}>
              Follow-up Date {isOverdue && <span className="overdue-tag">⚠ Overdue</span>}
            </label>
            <input className="text-input sm" type="date" value={form.followUpDate || ''} onChange={up('followUpDate')} style={isOverdue ? { borderColor: '#FF5A5A' } : {}}/>
          </div>
        </div>

        {/* Salary + URL */}
        <div className="detail-2col">
          <div className="detail-section">
            <label className="detail-label">Salary Range</label>
            <input className="text-input sm" value={form.salary || ''} onChange={up('salary')} placeholder="e.g. $90k–$120k"/>
          </div>
          <div className="detail-section">
            <label className="detail-label">Job URL</label>
            <div className="url-row">
              <input className="text-input sm" value={form.url || ''} onChange={e => {
                const url = e.target.value;
                setForm(f => ({ ...f, url }));
                onUpdate(job.id, { url });
                // Auto-extract role from URL slug if role is blank
                if (!form.role && url.length > 10) {
                  const extracted = extractRoleFromUrl(url);
                  if (extracted) {
                    setForm(f => ({ ...f, url, role: extracted }));
                    onUpdate(job.id, { url, role: extracted });
                  }
                }
              }} placeholder="https://..." onBlur={e => {
                // Also try extraction on blur if still no role
                if (!form.role && form.url) {
                  const extracted = extractRoleFromUrl(form.url);
                  if (extracted) { setForm(f => ({ ...f, role: extracted })); onUpdate(job.id, { role: extracted }); }
                }
              }}/>
              {form.url && <a href={form.url} target="_blank" rel="noreferrer" className="url-link btn btn-outline">↗</a>}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="detail-section">
          <label className="detail-label">Notes</label>
          <textarea className="text-input text-area sm" value={form.notes || ''} onChange={up('notes')} placeholder="Recruiter name, impressions, anything relevant…" rows={3}/>
        </div>

        {/* ── Interview Prep ── */}
        {isInterview && (
          <div className="prep-section">
            <div className="prep-header">◈ Interview Prep</div>
            <div className="detail-2col">
              <div className="detail-section">
                <label className="detail-label">Interviewer Name</label>
                <input className="text-input sm" value={form.interviewerName || ''} onChange={up('interviewerName')} placeholder="e.g. Jane Smith"/>
              </div>
              <div className="detail-section">
                <label className="detail-label">Interview Date/Time</label>
                <input className="text-input sm" type="datetime-local" value={form.interviewDate || ''} onChange={up('interviewDate')}/>
              </div>
            </div>
            <div className="detail-section">
              <label className="detail-label">Prep Notes</label>
              <textarea className="text-input text-area sm" value={form.prepNotes || ''} onChange={up('prepNotes')} placeholder="Key talking points, questions to ask, research notes…" rows={3}/>
            </div>
            <div className="prep-checklist">
              <div className="prep-checklist-title">Prep Checklist</div>
              {PREP_ITEMS.map((item, idx) => {
                const checked = (form.prepChecked || []).includes(idx);
                return (
                  <label key={idx} className={`prep-item ${checked ? 'checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => togglePrep(idx)}/>
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Activity Timeline ── */}
        {activity.length > 0 && (
          <div className="detail-section">
            <label className="detail-label">Activity</label>
            <div className="timeline">
              {activity.map((entry, i) => {
                const color = entry.to ? (STATUS_CONFIG[entry.to]?.color || 'var(--text2)') : 'var(--text2)';
                const text  = entry.type === 'created'
                  ? `Added · ${entry.to}`
                  : `${entry.from} → ${entry.to}`;
                const dt = new Date(entry.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <div key={i} className="timeline-entry">
                    <div className="timeline-dot" style={{ background: color }}/>
                    <div className="timeline-line" style={{ display: i === activity.length - 1 ? 'none' : undefined }}/>
                    <div className="timeline-content">
                      <span className="timeline-text" style={{ color }}>{text}</span>
                      <span className="timeline-date">{dt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="detail-footer">
        <button className="btn btn-danger" onClick={() => { onDelete(job.id); onClose(); }}>Delete</button>
        <span className="detail-hint">Changes save automatically</span>
      </div>
    </div>
  );
}

// ── Kanban Board (drag-and-drop) ──────────────────────────────────────────────
function KanbanBoard({ jobs, onCardClick, onStatusChange }) {
  const [draggingId,    setDraggingId]    = useState(null);
  const [dragOverStatus,setDragOverStatus]= useState(null);
  const today = new Date().toISOString().split('T')[0];

  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };
  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };
  const handleDrop = (e, status) => {
    e.preventDefault();
    if (draggingId) onStatusChange(draggingId, status);
    setDraggingId(null); setDragOverStatus(null);
  };
  const handleDragEnd = () => { setDraggingId(null); setDragOverStatus(null); };

  return (
    <div className="kanban">
      {STATUSES.map(status => {
        const cfg     = STATUS_CONFIG[status];
        const colJobs = jobs.filter(j => j.status === status);
        const isTarget = dragOverStatus === status;
        return (
          <div key={status}
            className={`kanban-col ${isTarget ? 'drag-over' : ''}`}
            onDragOver={e => handleDragOver(e, status)}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={e => handleDrop(e, status)}
          >
            <div className="kanban-col-header" style={{ borderTopColor: cfg.color }}>
              <span style={{ color: cfg.color }}>{cfg.icon} {status}</span>
              <span className="kanban-count" style={{ background: cfg.bg, color: cfg.color }}>{colJobs.length}</span>
            </div>
            <div className="kanban-cards">
              {colJobs.map(job => {
                const isOverdue  = job.followUpDate && job.followUpDate <= today && job.status !== 'Rejected';
                const isDragging = draggingId === job.id;
                const prepPct    = job.prepChecked?.length ? Math.round((job.prepChecked.length / PREP_ITEMS.length) * 100) : null;
                return (
                  <div key={job.id}
                    className={`kanban-card ${isOverdue ? 'kanban-overdue' : ''} ${isDragging ? 'dragging' : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, job.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onCardClick(job)}
                  >
                    <div className="kanban-drag-handle">⠿</div>
                    <div className="kanban-company">{job.company || '—'}</div>
                    {job.role && <div className="kanban-role">{job.role}</div>}
                    <div className="kanban-meta">
                      {job.date && <span>{job.date}</span>}
                      {job.salary && <span className="kanban-salary">{job.salary}</span>}
                    </div>
                    {isOverdue   && <div className="overdue-tag" style={{ marginTop: 6 }}>⚠ Follow-up overdue</div>}
                    {prepPct !== null && status === 'Interview' && (
                      <div className="kanban-prep-bar">
                        <div className="kanban-prep-fill" style={{ width: `${prepPct}%` }}/>
                        <span>{prepPct}% prep done</span>
                      </div>
                    )}
                    {job.notes && <div className="kanban-notes-hint">◆ Has notes</div>}
                  </div>
                );
              })}
              {colJobs.length === 0 && (
                <div className={`kanban-empty ${isTarget ? 'drag-target' : ''}`}>
                  {isTarget ? `Drop to mark ${status}` : `No ${status.toLowerCase()} apps`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Analytics View ────────────────────────────────────────────────────────────
function AnalyticsView({ jobs }) {
  const counts = jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] || 0) + 1; return acc; }, {});
  const total  = jobs.length;
  const responseRate = total > 0 ? Math.round(((counts.Interview || 0) + (counts.Offer || 0)) / total * 100) : 0;
  const offerRate    = total > 0 ? Math.round((counts.Offer || 0) / total * 100) : 0;
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = jobs.filter(j => j.followUpDate && j.followUpDate <= today && j.status !== 'Rejected').length;

  const byMonth = {};
  jobs.forEach(j => { if (j.date) { const m = j.date.substring(0,7); byMonth[m] = (byMonth[m] || 0) + 1; } });

  return (
    <div className="analytics">
      <div className="analytics-top">
        <div className="analytics-card">
          <div className="analytics-card-title">Breakdown</div>
          {total > 0 ? <DonutChart counts={counts}/> : <div className="chart-empty">No data yet</div>}
        </div>
        <div className="analytics-card">
          <div className="analytics-card-title">Key Metrics</div>
          <div className="metrics-grid">
            {[
              { val: total,                 label: 'Total',           color: '#4A9EFF'          },
              { val: `${responseRate}%`,    label: 'Response Rate',   color: '#F5A623'          },
              { val: `${offerRate}%`,       label: 'Offer Rate',      color: '#50E3A4'          },
              { val: counts.Interview || 0, label: 'Interviews',      color: '#F5A623'          },
              { val: counts.Rejected  || 0, label: 'Rejections',      color: '#FF5A5A'          },
              { val: overdueCount,          label: 'Follow-ups Due',  color: overdueCount > 0 ? '#FF5A5A' : 'var(--text2)' },
            ].map(({ val, label, color }) => (
              <div key={label} className="metric-card">
                <div className="metric-val" style={{ color }}>{val}</div>
                <div className="metric-label">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="analytics-card">
        <div className="analytics-card-title">Monthly Activity</div>
        <BarChart byMonth={byMonth}/>
      </div>

      <div className="analytics-card">
        <div className="analytics-card-title">Activity Heatmap — last 6 months</div>
        <ActivityHeatmap jobs={jobs}/>
      </div>

      <div className="analytics-card">
        <div className="analytics-card-title">Application Funnel</div>
        <div className="funnel">
          {[
            { label: 'Applied',        key: 'Applied',   color: '#4A9EFF' },
            { label: 'Got Interview',  key: 'Interview', color: '#F5A623' },
            { label: 'Received Offer', key: 'Offer',     color: '#50E3A4' },
          ].map(({ label, key, color }) => {
            const count = counts[key] || 0;
            const pct   = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="funnel-row">
                <div className="funnel-label">{label}</div>
                <div className="funnel-track"><div className="funnel-fill" style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, background: color }}/></div>
                <div className="funnel-stat"><span style={{ color, fontWeight: 700 }}>{count}</span><span className="funnel-pct"> ({Math.round(pct)}%)</span></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="analytics-card">
        <div className="analytics-card-title">Salary Comparison</div>
        <SalaryChart jobs={jobs}/>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [gapiReady,   setGapiReady]   = useState(false);
  const [gisReady,    setGisReady]    = useState(false);
  const [isSignedIn,  setIsSignedIn]  = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [progress,    setProgress]    = useState({ step: '', current: 0, total: 0 });
  const [filter,      setFilter]      = useState('All');
  const [sortBy,      setSortBy]      = useState('date');
  const [claudeKey,   setClaudeKey]   = useState('');
  const [keyInput,    setKeyInput]    = useState('');
  const [error,       setError]       = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme,       setTheme]       = useState(() => localStorage.getItem('jt-theme') || 'dark');
  const [view,        setView]        = useState('table');
  const [showAddModal,setShowAddModal]= useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [weeklyGoal,  setWeeklyGoal]  = useState(() => parseInt(localStorage.getItem('jt-goal') || '10'));
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [roleInput,     setRoleInput]     = useState('');

  // Chat
  const [chatOpen,     setChatOpen]     = useState(false);
  const [chatMessages, setChatMessages] = useState([{ role: 'assistant', text: "Hi! I'm your job search assistant. Ask me anything about your applications — like \"how many rejections do I have?\" or \"which companies haven't responded?\"" }]);
  const [chatInput,    setChatInput]    = useState('');
  const [chatLoading,  setChatLoading]  = useState(false);
  const chatEndRef   = useRef(null);
  const claudeKeyRef = useRef('');
  const addToastRef  = useRef(null);

  // ── Toasts ───────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'success', action = null, actionLabel = null) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, action, actionLabel }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === 'danger' ? 4500 : 3000);
  }, []);
  const removeToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  // ── Persist ─────────────────────────────────────────────────────────────────
  useEffect(() => { const s = localStorage.getItem('jt-jobs'); if (s) { try { setJobs(JSON.parse(s)); } catch(e) {} } }, []);
  useEffect(() => { localStorage.setItem('jt-jobs', JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('jt-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('jt-goal', String(weeklyGoal)); }, [weeklyGoal]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Google APIs ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const s1 = document.createElement('script'); s1.src = 'https://apis.google.com/js/api.js';
    s1.onload = () => window.gapi.load('client', async () => { await window.gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'] }); setGapiReady(true); });
    document.body.appendChild(s1);
    const s2 = document.createElement('script'); s2.src = 'https://accounts.google.com/gsi/client'; s2.onload = () => setGisReady(true);
    document.body.appendChild(s2);
  }, []);

  useEffect(() => {
    if (!gapiReady || !gisReady) return;
    const tc = window.google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: SCOPES, callback: resp => { if (resp.error) { setError('OAuth error: ' + resp.error); return; } setIsSignedIn(true); } });
    setTokenClient(tc);
  }, [gapiReady, gisReady]);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const signIn = () => { const key = keyInput.trim(); if (!key) { setError('Please enter your Anthropic API key first.'); return; } setClaudeKey(key); claudeKeyRef.current = key; tokenClient?.requestAccessToken({ prompt: '' }); };
  const signOut = () => { const t = window.gapi.client.getToken(); if (t) window.google.accounts.oauth2.revoke(t.access_token); window.gapi.client.setToken(''); setIsSignedIn(false); };

  // ── Jobs CRUD ────────────────────────────────────────────────────────────────
  const addJobManually = job => {
    setJobs(prev => [job, ...prev]);
    addToast(`✓ ${job.company || 'Application'} added`, 'success');
  };

  const updateJob = useCallback((id, updates) => {
    setJobs(prev => {
      const next = prev.map(j => {
        if (j.id !== id) return j;
        const nj = { ...j, ...updates };
        if (updates.status && updates.status !== j.status) {
          nj.activity = [...(j.activity || []), { ts: new Date().toISOString(), type: 'status_changed', from: j.status, to: updates.status }];
          // Toast + confetti for meaningful status changes
          setTimeout(() => {
            const cfg = STATUS_CONFIG[updates.status];
            if (updates.status === 'Offer') {
              addToastRef.current?.(`🎉 Offer from ${j.company}! Congratulations!`, 'offer');
              launchConfetti();
            } else if (updates.status === 'Interview') {
              addToastRef.current?.(`${cfg.icon} Interview lined up at ${j.company}!`, 'info');
            }
          }, 0);
        }
        return nj;
      });
      const found = next.find(j => j.id === id);
      if (found) setSelectedJob(prev => prev?.id === id ? found : prev);
      return next;
    });
  }, [addToast]);

  const deleteJob = useCallback(id => {
    setJobs(prev => {
      const job = prev.find(j => j.id === id);
      setTimeout(() => {
        addToastRef.current?.(
          `Deleted ${job?.company || 'application'}`,
          'danger',
          () => setJobs(p => [job, ...p]),
          'Undo'
        );
      }, 0);
      return prev.filter(j => j.id !== id);
    });
  }, []);

  // ── Fetch & Analyze ──────────────────────────────────────────────────────────
  const fetchAndAnalyze = useCallback(async () => {
    const activeKey = claudeKeyRef.current || claudeKey;
    if (!activeKey) { setError('API key missing.'); return; }
    setLoading(true); setError(''); setJobs([]); localStorage.removeItem('jt-jobs');
    try {
      setProgress({ step: 'Searching Gmail for job emails…', current: 0, total: 0 });

      const queries = [
        'subject:"thank you for applying"',
        'subject:"we received your application"',
        'subject:"application received"',
        'subject:"application submitted"',
        'subject:"you have applied"',
        'subject:"your application has been"',
        'subject:"application confirmation"',
        'subject:"applied for"',
        'subject:"application for"',
        'subject:"interview invitation" OR subject:"interview request" OR subject:"interview scheduled"',
        'subject:"phone screen" OR subject:"phone interview"',
        'subject:"technical assessment" OR subject:"coding assessment" OR subject:"hackerrank" OR subject:"codility"',
        'subject:"video interview" OR subject:"virtual interview" OR subject:"on-site interview"',
        'subject:"next steps" (job OR role OR position OR opportunity OR application)',
        'subject:"offer letter" OR subject:"job offer" OR subject:"offer of employment"',
        'subject:"pleased to offer" OR subject:"we would like to offer"',
        'subject:"unfortunately" (application OR position OR role OR opportunity)',
        'subject:"not moving forward" OR subject:"decided not to move forward"',
        'subject:"other candidates" OR subject:"not selected" OR subject:"not be moving forward"',
        'from:myworkdayjobs.com',
        'from:workday.com (application OR applied OR interview OR offer)',
        'from:greenhouse.io',
        'from:lever.co',
        'from:icims.com',
        'from:taleo.net',
        'from:successfactors.com',
        'from:smartrecruiters.com',
        'from:jobvite.com',
        'from:ashbyhq.com',
        'from:brassring.com',
        'from:linkedin.com (applied OR application OR interview)',
        'from:indeed.com (application OR applied OR interview)',
        'from:ziprecruiter.com (application OR applied)',
        '"micron technology" (application OR applied OR interview OR offer OR rejected OR assessment)',
        'from:micron.com',
        'subject:micron (application OR applied OR interview OR offer OR position OR role)',
        'subject:"your application" (position OR role OR job OR engineer OR analyst OR manager OR intern)',
        'subject:"application update" OR subject:"application status"',
        '"we have received your application"',
        '"thank you for your application"',
      ];

      const allIds = new Set();
      for (const q of queries) {
        let pt = null;
        do {
          const p = { userId: 'me', q: q + ' after:2026/01/01', maxResults: 50 };
          if (pt) p.pageToken = pt;
          const res = await window.gapi.client.gmail.users.messages.list(p);
          (res.result.messages || []).forEach(m => allIds.add(m.id));
          pt = res.result.nextPageToken;
        } while (pt && allIds.size < 600);
      }

      const ids = [...allIds];
      setProgress({ step: 'Fetching email content…', current: 0, total: ids.length });

      const emails = [];
      for (let i = 0; i < ids.length; i++) {
        setProgress({ step: 'Fetching email content…', current: i + 1, total: ids.length });
        try {
          const msg  = await window.gapi.client.gmail.users.messages.get({ userId: 'me', id: ids[i], format: 'metadata', metadataHeaders: ['Subject','From','Date'] });
          const hdrs = msg.result.payload?.headers || [];
          const get  = n => hdrs.find(h => h.name === n)?.value || '';
          emails.push({ subject: get('Subject'), from: get('From'), date: get('Date'), snippet: msg.result.snippet || '' });
        } catch(e) { /* skip */ }
      }

      setProgress({ step: 'Analyzing with Claude AI…', current: 0, total: emails.length });

      const BATCH = 12, results = [];
      for (let i = 0; i < emails.length; i += BATCH) {
        setProgress({ step: 'Analyzing with Claude AI…', current: Math.min(i + BATCH, emails.length), total: emails.length });
        const batch  = emails.slice(i, i + BATCH);
        const prompt = `You are an expert at analyzing job application emails. I will give you a batch of emails. For each one, decide if it represents a real job application event where the USER personally applied to a job or received a response to their application.

━━ SET isJobEmail: TRUE ONLY for these types ━━
• Application confirmation: "thank you for applying", "we received your application", Workday/Greenhouse/Lever/iCIMS confirmation receipts
• Interview invitation: phone screen invite, video interview request, on-site scheduling, technical/coding assessment invite
• Offer: offer letter, "we'd like to offer you", "pleased to extend an offer"
• Rejection: "unfortunately", "not moving forward", "decided to pursue other candidates"
• Status update: "your application is under review", "we've reviewed your application"

━━ SET isJobEmail: FALSE — do NOT include ━━
• Job alert emails ("New jobs matching your search", "Jobs you might like", "Recommended jobs")
• Newsletter or career advice emails
• Recruiter outreach where the user has NOT yet applied
• LinkedIn connection requests or generic notifications
• Password resets, account creations, marketing emails

━━ COMPANY: Extract the hiring company name ━━
• Look in the subject and snippet first
• myworkdayjobs.com / greenhouse.io / lever.co are ATS systems, NOT companies — find the real company name in the subject/snippet
• Do NOT return "Workday", "Greenhouse", "LinkedIn", "Indeed" as the company

━━ ROLE: Aggressively extract the job title ━━
Look for these patterns in subject AND snippet:
• "for the [ROLE] position/role/opportunity"
• "your application for [ROLE]" / "applied for [ROLE]"
• "Job Title: [ROLE]" / "Position: [ROLE]" / "Req #XXXXX [ROLE]"
• "[COMPANY] - [ROLE]" or "[ROLE] - [COMPANY]" in subject
• Common titles: Software Engineer, Data Analyst, Product Manager, Intern, etc.
Only return null if there is truly no role information anywhere.

Return ONLY a JSON array of exactly ${batch.length} objects. Each:
{ "isJobEmail": bool, "company": string|null, "role": string|null, "date": "YYYY-MM-DD"|null, "status": "Applied"|"Interview"|"Offer"|"Rejected"|null }
No markdown, no explanation.

EMAILS:
${batch.map((e, idx) => `[${idx}]\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nSnippet: ${e.snippet}`).join('\n\n---\n\n')}`;

        try {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': activeKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
          });
          const data   = await resp.json();
          if (data.error) throw new Error(data.error.message);
          const text   = data.content[0].text.trim().replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(text);
          parsed.forEach((item, idx) => {
            if (item?.isJobEmail && item.company && item.status) {
              const ts = new Date().toISOString();
              results.push({ ...item, id: `email-${i+idx}-${Date.now()}`, notes: '', url: '', salary: '', followUpDate: '', activity: [{ ts, type: 'created', from: null, to: item.status }], prepChecked: [], interviewerName: '', interviewDate: '', prepNotes: '' });
            }
          });
        } catch(e) { console.error('Claude batch error:', e); }
      }

      const RANK = { Offer: 4, Interview: 3, Applied: 2, Rejected: 1 };
      const merged = {};
      for (const r of results) {
        const company = (r.company || '').toLowerCase().trim();
        const role    = (r.role    || '').toLowerCase().trim();
        const key     = role ? `${company}__${role}` : `${company}__${r.date || r.id}`;
        if (!merged[key]) { merged[key] = { ...r }; }
        else {
          if ((RANK[r.status] || 0) > (RANK[merged[key].status] || 0)) merged[key].status = r.status;
          if (r.date && (!merged[key].date || r.date > merged[key].date)) merged[key].date = r.date;
          if (r.role && !merged[key].role) merged[key].role = r.role;
        }
      }

      const final = Object.values(merged).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setJobs(final);
      setProgress({ step: 'Done!', current: final.length, total: final.length });
      addToast(`✓ Found ${final.length} application${final.length !== 1 ? 's' : ''}`, 'success');
    } catch(e) { setError('Error: ' + e.message); }
    finally    { setLoading(false); }
  }, [claudeKey, addToast]);

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = filteredJobs.map(j => `"${j.company||''}","${j.role||''}","${j.date||''}","${j.status||''}","${j.salary||''}","${j.url||''}","${(j.notes||'').replace(/"/g,'""')}","${j.followUpDate||''}"`);
    const blob = new Blob(['Company,Role,Date,Status,Salary,URL,Notes,Follow-up Date\n' + rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'job-applications.csv'; a.click(); URL.revokeObjectURL(url);
  };

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || jobs.length === 0) return;
    const activeKey = claudeKeyRef.current || claudeKey;
    const userMsg   = chatInput.trim();
    setChatInput(''); setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]); setChatLoading(true);
    const today   = new Date().toISOString().split('T')[0];
    const summary = jobs.map(j => `${j.company} | ${j.role||'N/A'} | ${j.date||'N/A'} | ${j.status}${j.followUpDate ? ` | follow-up:${j.followUpDate}` : ''}${j.notes ? ` | notes:${j.notes}` : ''}`).join('\n');
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': activeKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: `You are a helpful, concise job search assistant. Today is ${today}. Applications:\n\n${summary}\n\nAnswer helpfully and specifically. Keep it short.\n\nQuestion: ${userMsg}` }] }),
      });
      const data  = await resp.json();
      setChatMessages(prev => [...prev, { role: 'assistant', text: data.content?.[0]?.text || 'Sorry, no response.' }]);
    } catch(e) { setChatMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + e.message }]); }
    finally    { setChatLoading(false); }
  };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  const filteredJobs = useMemo(() => {
    let list = filter === 'All' ? jobs : jobs.filter(j => j.status === filter);
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(j => (j.company||'').toLowerCase().includes(q) || (j.role||'').toLowerCase().includes(q)); }
    return [...list].sort((a, b) => {
      if (sortBy === 'date')    return (b.date||'').localeCompare(a.date||'');
      if (sortBy === 'company') return (a.company||'').localeCompare(b.company||'');
      if (sortBy === 'status')  return (b.status||'').localeCompare(a.status||'');
      if (sortBy === 'followup')return (a.followUpDate||'9999').localeCompare(b.followUpDate||'9999');
      return 0;
    });
  }, [jobs, filter, searchQuery, sortBy]);

  const counts       = useMemo(() => jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status]||0)+1; return acc; }, {}), [jobs]);
  const overdueCount = useMemo(() => jobs.filter(j => j.followUpDate && j.followUpDate <= today && j.status !== 'Rejected').length, [jobs, today]);
  const smartSuggestions = useMemo(() => getSmartSuggestions(jobs), [jobs]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="noise"/>

      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo-mark">JT</div>
          <div><h1 className="app-title">Job Tracker</h1><p className="app-sub">AI-powered application intelligence</p></div>
        </div>
        <div className="header-right">
          {isSignedIn && jobs.length > 0 && (
            <div className="view-toggle">
              {[['table','☰ Table'],['kanban','⊞ Board'],['analytics','◈ Analytics']].map(([v,lbl]) => (
                <button key={v} className={`view-btn ${view===v?'active':''}`} onClick={() => setView(v)}>{lbl}</button>
              ))}
            </div>
          )}
          <button className="theme-btn" onClick={() => setTheme(t => t==='dark'?'light':'dark')} title="Toggle theme">{theme==='dark'?'☀':'☾'}</button>
          {isSignedIn && <button className="btn btn-ghost" onClick={signOut}>Sign Out</button>}
        </div>
      </header>

      {!isSignedIn ? (
        /* Landing */
        <div className="landing">
          <div className="landing-content">
            <div className="hero-badge">POWERED BY CLAUDE AI</div>
            <h2 className="hero-title">Your inbox.<br/>Your career.<br/><span className="accent">Organized.</span></h2>
            <p className="hero-desc">Connect your Gmail and let Claude AI scan your emails, extract every job application, and build you a live tracker — automatically.</p>
            <div className="setup-card">
              <label className="input-label">Anthropic API Key</label>
              <div className="input-row"><input type="password" className="text-input" placeholder="sk-ant-…" value={keyInput} onChange={e => setKeyInput(e.target.value)} onKeyDown={e => e.key==='Enter' && signIn()}/></div>
              <p className="input-hint">Used only in your browser — never sent to any server.</p>
              <button className="btn btn-primary" onClick={signIn} disabled={!gapiReady||!gisReady||!keyInput.trim()}>{(!gapiReady||!gisReady)?'Loading…':'Connect Gmail →'}</button>
              {error && <p className="error-msg">{error}</p>}
            </div>
            <div className="features">
              {[
                ['◎','Auto-Detects Applications','Scans Gmail and finds every confirmation email'],
                ['◈','Tracks Interviews','Identifies scheduling and assessment emails'],
                ['✕','Catches Rejections','Spots the "unfortunately" emails automatically'],
                ['◆','AI Chat Assistant','Ask anything about your job search in plain English'],
                ['⊞','Drag-and-Drop Board','Visual pipeline — drag cards between stages'],
                ['◈','Charts & Analytics','Heatmaps, funnels, salary comparison, and more'],
              ].map(([icon, title, desc]) => (
                <div className="feature" key={title}><span className="feature-icon">{icon}</span><strong>{title}</strong><span>{desc}</span></div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Dashboard */
        <div className="dashboard">
          {jobs.length === 0 && !loading && (
            <div className="scan-prompt">
              <div className="scan-icon">⟳</div>
              <h3>Ready to scan your inbox</h3>
              <p>Claude will search your Gmail for job-related emails and build your tracker.</p>
              <div className="scan-actions">
                <button className="btn btn-primary" onClick={fetchAndAnalyze}>Scan Emails with AI</button>
                <button className="btn btn-outline" onClick={() => setShowAddModal(true)}>+ Add Manually</button>
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-card">
              <div className="spinner"/>
              <p className="loading-step">{progress.step}</p>
              {progress.total > 0 && (<><div className="progress-bar"><div className="progress-fill" style={{ width: `${(progress.current/progress.total)*100}%` }}/></div><p className="progress-text">{progress.current} / {progress.total}</p></>)}
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}

          {jobs.length > 0 && (
            <>
              {/* Stats */}
              <div className="stats-row">
                <div className="stat-card total"><span className="stat-num"><AnimatedNumber value={jobs.length}/></span><span className="stat-label">Total Applications</span></div>
                {STATUSES.map(s => counts[s] ? (
                  <div key={s} className="stat-card clickable" style={{ borderColor: STATUS_CONFIG[s].color }} onClick={() => { setFilter(s); setView('table'); }}>
                    <span className="stat-num" style={{ color: STATUS_CONFIG[s].color }}><AnimatedNumber value={counts[s]}/></span>
                    <span className="stat-label">{s}</span>
                  </div>
                ) : null)}
                {overdueCount > 0 && (
                  <div className="stat-card clickable" style={{ borderColor: '#FF5A5A' }} onClick={() => setSortBy('followup')}>
                    <span className="stat-num" style={{ color: '#FF5A5A' }}><AnimatedNumber value={overdueCount}/></span>
                    <span className="stat-label">Follow-ups Due</span>
                  </div>
                )}
                <WeeklyGoalWidget jobs={jobs} goal={weeklyGoal} onChangeGoal={setWeeklyGoal}/>
              </div>

              {/* Toolbar */}
              {view !== 'analytics' && (
                <div className="toolbar">
                  <input type="text" className="search-input" placeholder="Search company or role…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
                  <div className="filter-chips">
                    {['All',...STATUSES].map(f => (
                      <button key={f} className={`chip ${filter===f?'active':''}`}
                        style={filter===f && f!=='All' ? { background: STATUS_CONFIG[f]?.bg, color: STATUS_CONFIG[f]?.color, borderColor: STATUS_CONFIG[f]?.color } : {}}
                        onClick={() => setFilter(f)}>
                        {f!=='All' && STATUS_CONFIG[f]?.icon+' '}{f}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar-right">
                    <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                      <option value="date">Sort: Date</option>
                      <option value="company">Sort: Company</option>
                      <option value="status">Sort: Status</option>
                      <option value="followup">Sort: Follow-up</option>
                    </select>
                    <button className="btn btn-outline" onClick={() => setShowAddModal(true)}>+ Add Job</button>
                    <button className="btn btn-outline" onClick={exportCSV}>⬇ CSV</button>
                    <button className="btn btn-ghost" onClick={fetchAndAnalyze}>↺ Rescan</button>
                  </div>
                </div>
              )}

              {/* Table view */}
              {view === 'table' && (
                <div className="table-wrap">
                  <table className="jobs-table">
                    <thead><tr><th>#</th><th>Company</th><th>Role</th><th>Date</th><th>Follow-up</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {filteredJobs.map((job, idx) => {
                        const cfg = STATUS_CONFIG[job.status]; if (!cfg) return null;
                        const isOverdue = job.followUpDate && job.followUpDate <= today && job.status !== 'Rejected';
                        return (
                          <tr key={job.id} className={`job-row ${isOverdue?'overdue-row':''}`} onClick={() => setSelectedJob(job)}>
                            <td className="row-num">{idx+1}</td>
                            <td className="company-cell">{job.company||'—'}{job.notes && <span className="notes-dot" title="Has notes">•</span>}</td>
                            <td className="role-cell" onClick={e => { e.stopPropagation(); setEditingRoleId(job.id); setRoleInput(job.role || ''); }}>
                              {editingRoleId === job.id
                                ? <input className="role-edit-input" value={roleInput} autoFocus
                                    onChange={e => setRoleInput(e.target.value)}
                                    onBlur={() => { updateJob(job.id, { role: roleInput.trim() }); setEditingRoleId(null); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { updateJob(job.id, { role: roleInput.trim() }); setEditingRoleId(null); } if (e.key === 'Escape') setEditingRoleId(null); e.stopPropagation(); }}
                                    onClick={e => e.stopPropagation()}
                                  />
                                : <span className={job.role ? 'role-text' : 'role-empty'} title="Click to edit role">{job.role || '+ add role'}</span>
                              }
                            </td>
                            <td className="date-cell">{job.date||'—'}</td>
                            <td className="date-cell" onClick={e => e.stopPropagation()}>
                              {job.followUpDate
                                ? <span style={{ color: isOverdue?'#FF5A5A':'var(--text2)' }}>{isOverdue?'⚠ ':''}{job.followUpDate}</span>
                                : <span className="add-followup" onClick={() => setSelectedJob(job)}>+ Set</span>}
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              <select className="status-select-inline" value={job.status} onChange={e => updateJob(job.id, { status: e.target.value })} style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color }}>
                                {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].icon} {s}</option>)}
                              </select>
                            </td>
                            <td className="row-action-cell" onClick={e => e.stopPropagation()}>
                              <button className="icon-btn" onClick={() => setSelectedJob(job)}>→</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredJobs.length === 0 && <div className="empty-state">No applications match this filter.</div>}
                </div>
              )}

              {view === 'kanban' && <KanbanBoard jobs={filteredJobs} onCardClick={setSelectedJob} onStatusChange={(id, status) => updateJob(id, { status })}/>}
              {view === 'analytics' && <AnalyticsView jobs={jobs}/>}
            </>
          )}
        </div>
      )}

      {showAddModal && <AddJobModal onClose={() => setShowAddModal(false)} onAdd={addJobManually}/>}
      <ToastContainer toasts={toasts} onRemove={removeToast}/>

      {selectedJob && (
        <div className="panel-overlay" onClick={e => e.target===e.currentTarget && setSelectedJob(null)}>
          <JobDetailPanel job={selectedJob} onClose={() => setSelectedJob(null)} onUpdate={updateJob} onDelete={deleteJob}/>
        </div>
      )}

      {/* AI Chat */}
      {isSignedIn && jobs.length > 0 && (
        <>
          <button className="chat-fab" onClick={() => setChatOpen(o => !o)}>
            {chatOpen ? '✕' : '◆'}{!chatOpen && <span className="chat-fab-label">Ask AI</span>}
          </button>
          {chatOpen && (
            <div className="chat-panel">
              <div className="chat-header">
                <div className="chat-header-left">
                  <div className="chat-avatar">◆</div>
                  <div><div className="chat-title">Job Search Assistant</div><div className="chat-sub">Analyzing {jobs.length} applications</div></div>
                </div>
                <button className="btn btn-ghost" onClick={() => setChatOpen(false)}>✕</button>
              </div>
              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}><div className="chat-bubble">{msg.text}</div></div>
                ))}
                {chatLoading && <div className="chat-msg assistant"><div className="chat-bubble chat-typing"><span/><span/><span/></div></div>}
                <div ref={chatEndRef}/>
              </div>
              <div className="chat-suggestions">
                {smartSuggestions.map(s => <button key={s} className="suggestion-chip" onClick={() => setChatInput(s)}>{s}</button>)}
              </div>
              <div className="chat-input-row">
                <input className="chat-input" placeholder="Ask about your applications…" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key==='Enter' && sendChat()}/>
                <button className="chat-send" onClick={sendChat} disabled={chatLoading||!chatInput.trim()}>→</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
