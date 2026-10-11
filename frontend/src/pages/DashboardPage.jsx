import { useCallback, useEffect, useState } from 'react';
import { Droplets, Flower2, Heart, Package, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { useAuth } from '../services/AuthContext.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { api } from '../services/api.js';
import '../styles/daily.css';
import '../styles/progress.css';
import { classifyExpiry } from '../utils/expiry.js';
import { localDateParameters } from '../utils/localDate.js';

export function DashboardPage() {
  const { user } = useAuth();
  const name = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'friend';
  const [summary, setSummary] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get('/progress', { params: localDateParameters() }); setSummary(data); }
    catch (requestError) { setError(requestError.response?.data?.error?.message || 'Your dashboard could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const waterEntriesToday = summary?.water.filter((entry) => entry.entry_date === summary.today) || [];
  const waterToday = waterEntriesToday.reduce((sum, entry) => sum + entry.amount_ml, 0);
  const routineToday = summary?.completions.filter((entry) => entry.completed_on === summary.today) || [];
  const completeToday = routineToday.reduce((sum, entry) => sum + entry.completed_steps, 0);
  const routineTotalToday = routineToday.reduce((sum, entry) => sum + entry.total_steps, 0);
  const latestJournal = summary?.journal.filter((entry) => entry.entry_date <= summary.today).at(-1);
  const watchProducts = summary?.products.filter((product) => ['expired', 'soon'].includes(classifyExpiry(product, summary.today))) || [];
  const expiredProducts = summary?.products.filter((product) => classifyExpiry(product, summary.today) === 'expired').length || 0;
  const expiringSoon = summary?.products.filter((product) => classifyExpiry(product, summary.today) === 'soon').length || 0;
  const noExpiryDate = summary?.products.filter((product) => classifyExpiry(product, summary.today) === 'unknown').length || 0;
  return <div className="app-shell"><AppSidebar active="dashboard"/>
    <main className="dashboard-main"><header className="dashboard-top"><span className="eyebrow"><SignatureHeart/> Little Rituals · Your dashboard</span><span className="avatar">{name.slice(0,1).toUpperCase()}</span></header>
      <section className="greeting"><span className="eyebrow"><SignatureHeart/> A new day, at your own pace</span><h1>Hello, {name}.</h1><p>There is no perfect routine. Just a little moment for you, today. <SignatureHeart/></p></section>
      {error && <div className="daily-alert" role="alert">{error} <button type="button" className="daily-text-button" onClick={load}>Try again</button></div>}
      {loading ? <div className="daily-state" role="status"><span className="loading-heart">♡</span><p>Gathering your little moments…</p></div> : summary && <>
        <section className="dashboard-cards" aria-label="Today’s self-care overview">
          <Link to="/products" className="dashboard-card"><Package/><span className="dashboard-card-kicker">Your product shelf</span><strong>{summary.products.length}</strong><p>{summary.products.filter((product) => product.status === 'using').length} currently in use</p></Link>
          <Link to="/water" className="dashboard-card"><Droplets/><span className="dashboard-card-kicker">Water today</span><strong>{waterEntriesToday.length ? waterToday.toLocaleString() : '—'}{waterEntriesToday.length > 0 && <small> ml</small>}</strong><p>{waterEntriesToday.length ? `${summary.waterGoalMl.toLocaleString()} ml personal goal · ${waterToday >= summary.waterGoalMl ? 'reached ♡' : 'logged so far'}` : 'No entries logged today · goal ' + summary.waterGoalMl.toLocaleString() + ' ml'}</p></Link>
          <Link to="/routine" className="dashboard-card"><Flower2/><span className="dashboard-card-kicker">Routine steps today</span><strong>{routineToday.length ? `${completeToday} / ${routineTotalToday}` : '—'}</strong><p>{summary.routines.length ? routineToday.length ? `${summary.routines.length} saved ${summary.routines.length === 1 ? 'routine' : 'routines'}` : 'No completion logged today yet' : 'Create a gentle routine when you’re ready'}</p></Link>
          <Link to="/journal" className="dashboard-card"><Heart/><span className="dashboard-card-kicker">Latest skin check-in</span><strong>{latestJournal?.skin_rating ? `${latestJournal.skin_rating} / 5` : '—'}</strong><p>{latestJournal ? `Your note from ${new Date(`${latestJournal.entry_date}T00:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'})}` : 'No check-in saved yet'}</p></Link>
        </section>
        <section className="dashboard-shelf"><header><div><span className="eyebrow"><SignatureHeart/> A little shelf care</span><h2>Expiry watch</h2></div><Link to="/products">View products <span aria-hidden="true">→</span></Link></header>
          {!summary.products.length ? <p className="dashboard-empty">Your product shelf is waiting for you. <Link to="/products">Add a product ♡</Link></p> : <><div className="dashboard-expiry-counts"><span>{expiredProducts} past date</span><span>{expiringSoon} within 30 days</span><span>{noExpiryDate} no date saved</span></div>{!watchProducts.length ? <p className="dashboard-empty">No products are past their recorded date or within 30 days of expiry.</p> : <ul>{watchProducts.slice(0,4).map((product) => <li key={product.id}><Package size={16}/><span><strong>{product.name}</strong><small>{product.brand || (classifyExpiry(product, summary.today) === 'expired' ? 'Past expiry' : 'In use')}</small></span><time dateTime={product.expiry_date || undefined}>{product.expiry_date ? new Date(`${product.expiry_date}T00:00:00Z`).toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'}) : 'Date unknown'}</time></li>)}</ul>}</>}
        </section>
        <Link to="/progress" className="dashboard-progress-link"><span className="note-icon"><Sparkles size={20}/></span><span><strong>Your weekly progress</strong><small>See your entries over time and review ingredient notes</small></span><span aria-hidden="true">→</span></Link>
      </>}
      <p className="dashboard-disclaimer">Your personal notes are for reflection only, not medical advice. <SignatureHeart/></p>
    </main>
  </div>;
}
