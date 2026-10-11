import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookHeart, CalendarDays, Search, Trash2 } from 'lucide-react';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { api } from '../services/api.js';
import '../styles/daily.css';

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const blankEntry = (entryDate = today()) => ({ entryDate, skinRating: '', skinCondition: '', mood: '', sleepHours: '', concerns: '', notes: '', tags: '' });
const splitList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const messageOf = (error, fallback) => error.response?.data?.error?.message || fallback;

function fromRecord(entry) {
  return { entryDate: entry.entry_date, skinRating: entry.skin_rating ?? '', skinCondition: entry.skin_condition || '', mood: entry.mood || '', sleepHours: entry.sleep_hours ?? '', concerns: (entry.concerns || []).join(', '), notes: entry.notes || '', tags: (entry.tags || []).join(', ') };
}

export function JournalPage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(blankEntry());
  const [editingId, setEditingId] = useState('');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams(); if (fromDate) params.set('from', fromDate); if (toDate) params.set('to', toDate);
      const { data } = await api.get(`/journal${params.size ? `?${params}` : ''}`); setEntries(data.entries || []);
    } catch (requestError) { setError(messageOf(requestError, 'Your journal could not be opened. Check that the API is running and try again.')); }
    finally { setLoading(false); }
  }, [fromDate, toDate]);
  useEffect(() => { load(); }, [load]);

  const visibleEntries = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return entries;
    return entries.filter((entry) => [entry.notes, entry.skin_condition, entry.mood, ...(entry.concerns || []), ...(entry.tags || [])].filter(Boolean).join(' ').toLocaleLowerCase().includes(term));
  }, [entries, query]);

  function startNew() { setEditingId(''); setForm(blankEntry()); setError(''); setNotice(''); }
  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const payload = { ...form, skinRating: form.skinRating === '' ? null : Number(form.skinRating), sleepHours: form.sleepHours === '' ? null : Number(form.sleepHours), concerns: splitList(form.concerns), tags: splitList(form.tags) };
    try {
      if (editingId) await api.patch(`/journal/${editingId}`, payload); else await api.post('/journal', payload);
      setNotice('A little note, safely saved. ♡'); setEditingId(''); setForm(blankEntry()); await load();
    } catch (requestError) { setError(messageOf(requestError, 'Your journal entry could not be saved.')); }
    finally { setBusy(false); }
  }

  function edit(entry) { setEditingId(entry.id); setForm(fromRecord(entry)); setError(''); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  async function remove(entry) {
    if (!window.confirm(`Delete your journal entry from ${entry.entry_date}? This cannot be undone.`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.delete(`/journal/${entry.id}`); if (editingId === entry.id) startNew(); setNotice('Your entry was removed.'); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'Your entry could not be deleted.')); }
    finally { setBusy(false); }
  }

  return <div className="app-shell daily-shell"><AppSidebar active="journal" className="daily-sidebar"/><main className="daily-main">
    <header className="daily-heading"><span className="eyebrow"><SignatureHeart/> A quiet place to notice</span><h1>Self-Care Journal</h1><p>Leave a small note about how your skin and your day are feeling. This space is private to you.</p></header>
    {error && <p className="daily-alert" role="alert">{error}</p>}{notice && <p className="daily-notice" role="status">{notice}</p>}
    <section className="journal-layout">
      <form className="daily-panel journal-editor" onSubmit={save}><span className="daily-kicker"><BookHeart size={15}/>{editingId ? ' Edit a note' : ' A moment for you'}</span><h2>{editingId ? 'Update your entry' : 'Write a journal entry'}</h2>
        <label>Entry date<input type="date" required value={form.entryDate} onChange={(event) => update('entryDate', event.target.value)}/></label>
        <div className="journal-form-row"><label>How did your skin feel today?<input maxLength={240} value={form.skinCondition} onChange={(event) => update('skinCondition', event.target.value)} placeholder="Calm, dry, a little unsettled…"/></label><label>Mood<input maxLength={80} value={form.mood} onChange={(event) => update('mood', event.target.value)} placeholder="Whatever word fits"/></label></div>
        <div className="journal-form-row"><label>Skin rating <span className="field-hint">Optional, just your own reflection</span><select value={form.skinRating} onChange={(event) => update('skinRating', event.target.value)}><option value="">No rating</option>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select></label><label>Sleep (hours)<input type="number" min="0" max="24" step="0.25" value={form.sleepHours} onChange={(event) => update('sleepHours', event.target.value)} placeholder="Optional"/></label></div>
        <label>Things you noticed <span className="field-hint">Separate a few notes with commas</span><input value={form.concerns} onChange={(event) => update('concerns', event.target.value)} placeholder="Dryness, calm day…"/></label>
        <label>Your notes<textarea rows="5" maxLength={5000} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="A small thing you want to remember…"/></label>
        <label>Tags <span className="field-hint">Optional, comma-separated</span><input value={form.tags} onChange={(event) => update('tags', event.target.value)} placeholder="evening, slow morning…"/></label>
        <div className="form-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Save entry'} <SignatureHeart/></button>{editingId && <button type="button" className="button button-soft" onClick={startNew}>Cancel edit</button>}</div>
      </form>
      <section className="journal-entries"><header className="journal-list-heading"><div><span className="daily-kicker"><CalendarDays size={15}/> Your notes</span><h2>Pages from your journal</h2></div><span className="entry-count">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></header>
        <div className="journal-filters"><label><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)}/></label><label><span>To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)}/></label><label className="journal-search"><Search size={16}/><span className="visually-hidden">Search your notes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your notes"/></label></div>
        {loading ? <div className="daily-state" role="status">Opening your journal… ♡</div> : error && !entries.length ? <div className="daily-state"><p>Your saved pages will appear here when the journal is available.</p><button className="daily-text-button" onClick={load}>Try again</button></div> : visibleEntries.length ? <div className="journal-entry-list">{visibleEntries.map((entry) => <article className="journal-entry-card" key={entry.id}><header><time dateTime={entry.entry_date}>{new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</time><SignatureHeart/></header><div className="journal-observations">{entry.skin_rating && <span>Skin {entry.skin_rating}/5</span>}{entry.skin_condition && <span>{entry.skin_condition}</span>}{entry.mood && <span>{entry.mood}</span>}{entry.sleep_hours !== null && <span>{entry.sleep_hours} h sleep</span>}</div>{entry.notes && <p className="journal-note-text">{entry.notes}</p>}{entry.concerns?.length > 0 && <p className="journal-meta">Noticed: {entry.concerns.join(' · ')}</p>}{entry.tags?.length > 0 && <div className="journal-tags">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}<footer><button type="button" onClick={() => edit(entry)}>Edit entry</button><button type="button" className="danger" onClick={() => remove(entry)} disabled={busy}><Trash2 size={14}/> Delete</button></footer></article>)}</div> : <div className="daily-state daily-empty"><span className="empty-heart">♡</span><h3>{entries.length ? 'No notes match that search' : 'Your pages are waiting'}</h3><p>{entries.length ? 'Try a different word or date range.' : 'When you save a reflection, it will find a quiet home here.'}</p>{query && <button className="daily-text-button" onClick={() => setQuery('')}>Clear search</button>}</div>}
      </section>
    </section>
    <p className="daily-footnote">Your journal is for your personal observations. It does not diagnose or treat skin conditions.</p>
  </main></div>;
}
