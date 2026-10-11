import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Brand } from '../components/Brand.jsx';
import { useAuth } from '../services/AuthContext.jsx';

const titles = {
  login: ['Welcome back', 'Your little rituals are right where you left them.'],
  register: ['A softer routine starts here', 'Create your private Little Rituals space.'],
  forgot: ['A fresh start is close', 'We’ll send a secure password reset link to your inbox.'],
  reset: ['Choose a new password', 'Make it something only you know.'],
};

function friendlyError(message = '') {
  if (/invalid login credentials/i.test(message)) return 'That email and password did not match. Try again or reset your password.';
  if (/already registered/i.test(message)) return 'An account with this email already exists. Try signing in instead.';
  if (/password should be at least/i.test(message)) return 'Choose a longer password.';
  return message || 'We could not complete that request. Please try again.';
}

export function AuthPage({ initialMode }) {
  const { mode: routeMode } = useParams();
  const mode = initialMode || routeMode || 'login';
  const { user, configured, signIn, signUp, resetPassword, updatePassword } = useAuth();
  const [values, setValues] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [title, subtitle] = titles[mode] ?? titles.login;

  if (user && mode !== 'reset') return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setMessage('');
    if (!configured) { setError('Sign in is not connected yet. Add the new Supabase project settings to the local environment first.'); return; }
    if (mode === 'register' && values.password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    setBusy(true);
    try {
      let result;
      if (mode === 'login') result = await signIn(values.email, values.password);
      else if (mode === 'register') result = await signUp(values.email, values.password, values.displayName.trim());
      else if (mode === 'forgot') result = await resetPassword(values.email);
      else result = await updatePassword(values.password);
      if (result.error) throw result.error;
      if (mode === 'register') {
        setMessage(result.data?.session ? 'Your account is ready. Welcome to Little Rituals.' : 'Check your inbox to confirm your email, then come back to sign in.');
        if (result.data?.session) navigate('/dashboard', { replace: true });
      } else if (mode === 'forgot') setMessage('If an account exists for this email, a reset link is on its way.');
      else if (mode === 'reset') { setMessage('Your password has been updated.'); navigate('/dashboard', { replace: true }); }
      else navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) { setError(friendlyError(err.message)); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <section className="auth-aside">
      <Brand />
      <div><span className="eyebrow">A little more care for you</span><h1>Small things.<br />Soft moments.</h1><p>Make space for the rituals that make an ordinary day feel a little kinder.</p></div>
      <p className="aside-note">Your journal is personal. Your pace is yours.</p>
    </section>
    <section className="auth-main"><div className="auth-card">
      <Brand className="mobile-brand" />
      <span className="eyebrow">Little Rituals</span><h2>{title}</h2><p className="auth-subtitle">{subtitle}</p>
      {!configured && <div className="notice" role="status">Sign-in is waiting for the new Supabase project configuration.</div>}
      <form onSubmit={handleSubmit}>
        {mode === 'register' && <label>Your name<input autoComplete="name" maxLength="80" required value={values.displayName} onChange={(e) => setValues({ ...values, displayName: e.target.value })} /></label>}
        {mode !== 'reset' && <label>Email address<input type="email" autoComplete="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>}
        {mode !== 'forgot' && <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : 1} required value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} /></label>}
        {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
        <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create my account' : mode === 'forgot' ? 'Send reset link' : 'Save new password'}</button>
      </form>
      {mode === 'login' && <Link className="text-link forgot-link" to="/forgot-password">Forgot password?</Link>}
      <p className="auth-switch">{mode === 'login' ? <>New to Little Rituals? <Link to="/register">Create an account</Link></> : <>Already have an account? <Link to="/login">Sign in</Link></>}</p>
      <p className="privacy-note">For personal tracking and education only — not medical advice.</p>
    </div></section>
  </main>;
}
