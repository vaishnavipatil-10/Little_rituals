import { useCallback, useEffect, useState } from 'react';
import { Droplets, Minus, Plus, Trash2 } from 'lucide-react';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { api } from '../services/api.js';
import '../styles/daily.css';

function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}
const messageOf = (error, fallback) => error.response?.data?.error?.message || fallback;

export function WaterTrackerPage() {
  const [summary, setSummary] = useState({ entries: [], totalMl: 0, goalMl: 2000, volumeUnit: 'ml' });
  const [goalInput, setGoalInput] = useState('2000');
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const dayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const bounds = localDayBounds();
      const params = new URLSearchParams(bounds);
      const { data } = await api.get(`/water?${params}`);
      setSummary(data); setGoalInput(String(data.goalMl));
      setEdits(Object.fromEntries((data.entries || []).map((entry) => [entry.id, String(entry.amount_ml)])));
    } catch (requestError) { setError(messageOf(requestError, 'Your water tracker could not be opened. Check that the API is running and try again.')); }
    finally { setLoading(false); }
  }, [refreshKey]);

  useEffect(() => { load(); }, [load]);
  const progress = summary.goalMl > 0 ? Math.min(100, Math.round(summary.totalMl / summary.goalMl * 100)) : 0;

  async function addWater(amountMl) {
    if (busy) return;
    setBusy(`add-${amountMl}`); setError(''); setNotice('');
    try { await api.post('/water', { amountMl, loggedAt: new Date().toISOString() }); setNotice('A little water, logged. ♡'); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'That water entry could not be saved.')); }
    finally { setBusy(''); }
  }

  async function saveGoal(event) {
    event.preventDefault(); setBusy('goal'); setError(''); setNotice('');
    try { const { data } = await api.patch('/water/goal', { goalMl: Number(goalInput) }); setSummary((current) => ({ ...current, goalMl: data.goalMl, volumeUnit: data.volumeUnit })); setGoalInput(String(data.goalMl)); setNotice('Your personal water goal is saved. ♡'); }
    catch (requestError) { setError(messageOf(requestError, 'Your water goal could not be saved.')); }
    finally { setBusy(''); }
  }

  async function updateEntry(entry) {
    const amountMl = Number(edits[entry.id]); if (!Number.isInteger(amountMl) || amountMl < 1 || amountMl > 5000) { setError('Enter a whole number between 1 and 5,000 ml.'); return; }
    setBusy(`entry-${entry.id}`); setError(''); setNotice('');
    try { await api.patch(`/water/${entry.id}`, { amountMl }); setNotice('Water amount corrected.'); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'That entry could not be updated.')); }
    finally { setBusy(''); }
  }

  async function deleteEntry(entry) {
    if (!window.confirm(`Remove the ${entry.amount_ml} ml entry?`)) return;
    setBusy(`entry-${entry.id}`); setError(''); setNotice('');
    try { await api.delete(`/water/${entry.id}`); setNotice('Water entry removed.'); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'That entry could not be removed.')); }
    finally { setBusy(''); }
  }

  return <div className="app-shell daily-shell"><AppSidebar active="water" className="daily-sidebar"/><main className="daily-main water-main">
    <header className="daily-heading"><span className="eyebrow"><SignatureHeart/> A gentle pause</span><h1>Water Tracker</h1><p>Notice what you’ve had today, one small glass at a time. {dayLabel}.</p></header>
    {error && <p className="daily-alert" role="alert">{error}</p>}{notice && <p className="daily-notice" role="status">{notice}</p>}
    {loading ? <div className="daily-state" role="status">Gathering today’s sips… ♡</div> : <>
      <section className="water-overview">
        <article className="daily-panel water-progress-card"><div className="water-total"><span className="water-icon"><Droplets size={22}/></span><div><span className="daily-kicker">Today so far</span><h2>{summary.totalMl.toLocaleString()} <small>ml</small></h2><p>{summary.entries.length} {summary.entries.length === 1 ? 'entry' : 'entries'} · your goal is {summary.goalMl.toLocaleString()} ml</p></div><SignatureHeart/></div><div className="water-track" role="progressbar" aria-label="Water goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}><span style={{ width: `${progress}%` }}/></div><div className="water-progress-copy"><span>{progress}% of your personal goal</span>{summary.totalMl >= summary.goalMl && <span className="water-done"><SignatureHeart/> Your chosen goal reached</span>}</div><p className="water-gentle-note">Your goal is personal; there is no single daily target that fits everyone.</p></article>
        <form className="daily-panel water-goal-card" onSubmit={saveGoal}><span className="daily-kicker">Make it yours</span><h2>Daily goal</h2><p>Choose a target that feels right for you. You can change it any time.</p><label>Goal in millilitres<input type="number" min="250" max="10000" step="50" required value={goalInput} onChange={(event) => setGoalInput(event.target.value)}/></label><button className="button button-soft" disabled={busy === 'goal'}>{busy === 'goal' ? 'Saving…' : 'Save my goal'}</button></form>
      </section>
      <section className="daily-panel water-add-card"><div><span className="daily-kicker">A small top-up</span><h2>Log a glass</h2><p>Choose a quick amount or add a custom pour.</p></div><div className="water-quick-add">{[250, 500, 750].map((amount) => <button type="button" className="water-add-button" key={amount} onClick={() => addWater(amount)} disabled={Boolean(busy)}><Plus size={16}/>{amount} ml</button>)}</div><form className="water-custom-add" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const amount = Number(data.get('customAmount')); if (Number.isInteger(amount) && amount > 0 && amount <= 5000) { addWater(amount); event.currentTarget.reset(); } else setError('Enter a whole number between 1 and 5,000 ml.'); }}><label>Custom amount<input name="customAmount" type="number" min="1" max="5000" step="1" placeholder="ml" required/></label><button className="button button-primary" disabled={Boolean(busy)}>Add amount</button></form></section>
      <section className="water-entries-section"><header><div><span className="daily-kicker">Saved for today</span><h2>Today’s entries</h2></div><button type="button" className="daily-text-button" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button></header>
        {summary.entries.length ? <div className="water-entry-list">{summary.entries.map((entry) => <form className="water-entry-row" key={entry.id} onSubmit={(event) => { event.preventDefault(); updateEntry(entry); }}><span className="water-entry-mark"><Droplets size={16}/></span><span className="water-entry-time">{new Date(entry.logged_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span><label><span className="visually-hidden">Amount in millilitres</span><input type="number" min="1" max="5000" step="1" value={edits[entry.id] ?? entry.amount_ml} onChange={(event) => setEdits({ ...edits, [entry.id]: event.target.value })}/><span>ml</span></label><button type="submit" className="daily-text-button" disabled={busy === `entry-${entry.id}`}>Save</button><button type="button" className="daily-icon-button danger" aria-label="Delete water entry" disabled={Boolean(busy)} onClick={() => deleteEntry(entry)}><Trash2 size={16}/></button></form>)}</div> : <div className="daily-state daily-empty water-empty"><span className="empty-heart">♡</span><h3>No water logged yet today</h3><p>Whenever you’re ready, add a glass above.</p></div>}
      </section>
    </>}
    <p className="daily-footnote">This tracker is for personal logging, not medical guidance. Follow advice from your health professional if you have fluid restrictions or specific needs.</p>
  </main></div>;
}
