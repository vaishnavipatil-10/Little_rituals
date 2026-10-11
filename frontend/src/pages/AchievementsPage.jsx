import { useCallback, useEffect, useState } from 'react';
import { Award, Download, Heart, LockKeyhole, Sparkles } from 'lucide-react';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { useAuth } from '../services/AuthContext.jsx';
import { api } from '../services/api.js';
import { localDateParameters } from '../utils/localDate.js';
import '../styles/daily.css';
import '../styles/achievements.css';

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const prettyDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function certificateSvg(title, name, startDate, endDate) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(title)}</title><desc id="desc">A Little Rituals certificate earned from saved activity dated ${escapeXml(startDate)} through ${escapeXml(endDate)}.</desc><rect width="1200" height="850" fill="#f8f3ec"/><rect x="35" y="35" width="1130" height="780" rx="18" fill="none" stroke="#933b5b" stroke-width="2"/><rect x="54" y="54" width="1092" height="742" rx="12" fill="none" stroke="#b5728a" stroke-width="1"/><text x="600" y="180" text-anchor="middle" fill="#933b5b" font-family="Georgia,serif" font-size="25" letter-spacing="7">LITTLE RITUALS ♡</text><text x="600" y="300" text-anchor="middle" fill="#332c2e" font-family="Georgia,serif" font-size="49">${escapeXml(title)}</text><text x="600" y="378" text-anchor="middle" fill="#756a6d" font-family="Arial,sans-serif" font-size="21">Presented to</text><text x="600" y="465" text-anchor="middle" fill="#73334d" font-family="Georgia,serif" font-size="50">${escapeXml(name)}</text><text x="600" y="535" text-anchor="middle" fill="#756a6d" font-family="Arial,sans-serif" font-size="20">For verified activity saved from</text><text x="600" y="580" text-anchor="middle" fill="#332c2e" font-family="Arial,sans-serif" font-size="21">${escapeXml(prettyDate(startDate))} — ${escapeXml(prettyDate(endDate))}</text><text x="600" y="680" text-anchor="middle" fill="#933b5b" font-family="Georgia,serif" font-size="34">Small things. Soft moments. ♡</text></svg>`;
}

function downloadCertificate(certificate, name) {
  const blob = new Blob([certificateSvg(certificate.title, name, certificate.startDate, certificate.endDate)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${certificate.id}.svg`; document.body.append(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AchievementsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const name = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Little Rituals member';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data: result } = await api.get('/achievements', { params: localDateParameters() }); setData(result); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || 'Your achievements could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const certificates = data?.certificates || [];

  return <div className="app-shell"><AppSidebar active="achievements"/><main className="achievements-main">
    <header className="daily-heading"><span className="daily-kicker"><SignatureHeart/> Milestones from your own records</span><h1>Your little achievements</h1><p>Every badge comes from activity saved to your account. Quiet days count as part of your story too.</p></header>
    {error && <div className="daily-alert" role="alert">{error}<button type="button" className="daily-text-button" onClick={load}>Try again</button></div>}
    {loading ? <div className="daily-state" role="status"><span className="loading-heart">♡</span><p>Checking your saved milestones…</p></div> : data && <>
      <section className="achievement-summary" aria-label="Activity totals"><article className="daily-panel"><span className="achievement-icon"><Award size={18}/></span><span className="daily-kicker">Fully completed routine days</span><strong>{data.counts.completedRoutineDays}</strong><small>Days with at least one routine's saved steps fully completed</small></article><article className="daily-panel"><span className="achievement-icon sage"><Heart size={18}/></span><span className="daily-kicker">Journal days</span><strong>{data.counts.journalDays}</strong><small>Distinct dates with a saved journal entry</small></article></section>
      <section className="achievement-section"><header><span className="daily-kicker"><Sparkles size={14}/> Earned from saved activity</span><h2>Badges</h2><p>Milestones are derived from your records and listed once each. No separate award rows are written.</p></header>
        <div className="achievement-grid">{data.badges.map((badge) => <article className={`daily-panel achievement-card ${badge.earned ? 'earned' : 'locked'}`} key={badge.id}><span className="achievement-icon">{badge.earned ? <Heart size={19} fill="currentColor"/> : <LockKeyhole size={17}/>}</span><div><h3>{badge.title}{badge.earned && <SignatureHeart/>}</h3><p>{badge.description}</p>{badge.earned ? <small>Earned {prettyDate(badge.earnedOn)}</small> : <small>Not earned yet · based on future saved activity</small>}</div></article>)}</div>
      </section>
      <section className="achievement-section certificate-section"><header><span className="daily-kicker"><Award size={14}/> Printable keepsakes</span><h2>Consistency certificates</h2><p>Downloads are unlocked only when the records show each consecutive day in the milestone period.</p></header>
        <div className="certificate-grid">{certificates.map((certificate) => <article className="daily-panel certificate-card" key={certificate.id}><span className="certificate-heart"><SignatureHeart/></span><div><h3>{certificate.title}</h3><p>{certificate.id.startsWith('routine') ? `Longest verified routine-completion streak: ${data.streaks.routine.days} / 7 days.` : `Longest verified journal-entry streak: ${data.streaks.journal.days} / 30 days.`}</p>{certificate.eligible ? <p className="certificate-range">{prettyDate(certificate.startDate)} — {prettyDate(certificate.endDate)}</p> : <small>Locked · no certificate is generated until eligible.</small>}</div><button type="button" className="button button-primary" disabled={!certificate.eligible} onClick={() => downloadCertificate(certificate, name)}><Download size={15}/>{certificate.eligible ? 'Download SVG' : 'Not yet earned'}</button></article>)}</div>
        <p className="achievement-footnote">SVG certificates can be opened in a browser or printed to PDF. They are generated from the milestone dates returned by your saved records.</p>
      </section>
      <p className="achievement-disclaimer"><SignatureHeart/> These milestones describe recorded app activity only. They do not measure skin health or treatment outcomes.</p>
    </>}
  </main></div>;
}
