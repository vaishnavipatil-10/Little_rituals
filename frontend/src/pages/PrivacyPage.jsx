import { useState } from 'react';
import { Download, FileJson, LockKeyhole, ShieldCheck } from 'lucide-react';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { api } from '../services/api.js';
import '../styles/daily.css';
import '../styles/privacy.css';

export function PrivacyPage() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function exportData() {
    setBusy(true); setError(''); setNotice('');
    try {
      const { data } = await api.get('/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `little-rituals-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Your personal data export has been downloaded. Store the file somewhere private.');
    } catch (requestError) { setError(requestError.response?.data?.error?.message || 'Your export could not be downloaded. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="app-shell"><AppSidebar active="privacy"/><main className="privacy-main">
    <header className="daily-heading"><span className="daily-kicker"><SignatureHeart/> Your data, in your hands</span><h1>Privacy & data</h1><p>Export a copy of the Little Rituals records saved to your account. The export is prepared by the authenticated API and scoped to your signed-in user.</p></header>
    {error && <p className="daily-alert" role="alert">{error}</p>}{notice && <p className="daily-notice" role="status"><SignatureHeart/> {notice}</p>}
    <section className="privacy-card daily-panel"><span className="privacy-icon"><FileJson size={22}/></span><div><span className="daily-kicker">Portable copy</span><h2>Export your data</h2><p>The JSON file includes your profile and skin preferences, products and ingredient links, routines and completion records, journal entries, water entries, and user settings. It contains personal notes, so keep it private.</p><button type="button" className="button button-primary" disabled={busy} onClick={exportData}><Download size={16}/>{busy ? 'Preparing your file…' : 'Download my data'}</button></div></section>
    <section className="privacy-card deletion-card daily-panel"><span className="privacy-icon muted"><LockKeyhole size={21}/></span><div><span className="daily-kicker">Account deletion</span><h2>Delete an account</h2><p>Self-service account deletion is not enabled. Safely deleting a Supabase Auth user requires a trusted administrative operation; this app does not hold or expose a service-role key for that purpose.</p><p>If you own this Supabase project, use Supabase Dashboard → Authentication → Users to delete the account. The current schema cascades deletion to the associated Little Rituals profile and personal records. Confirm the account carefully before deleting; this cannot be undone.</p><small><ShieldCheck size={14}/> No account or database deletion is performed from this page.</small></div></section>
    <p className="privacy-footnote"><SignatureHeart/> The download is created only after your access token is verified. The endpoint applies owner filters and the project’s Row Level Security policies.</p>
  </main></div>;
}
