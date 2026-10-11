import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Award, Droplets, Flower2, Heart, Leaf, LogOut, NotebookPen, Package, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { Brand } from './Brand.jsx';
import { SignatureHeart } from './SignatureHeart.jsx';
import { useAuth } from '../services/AuthContext.jsx';

const links = [
  ['dashboard', '/dashboard', Sparkles, 'Home'],
  ['products', '/products', Package, 'My Products'],
  ['ingredients', '/ingredients', Leaf, 'Ingredient Explorer'],
  ['routine', '/routine', Flower2, 'Routines'],
  ['journal', '/journal', NotebookPen, 'Journal'],
  ['water', '/water', Droplets, 'Water Tracker'],
  ['progress', '/progress', Heart, 'My Progress'],
  ['achievements', '/achievements', Award, 'Achievements'],
  ['privacy', '/settings', ShieldCheck, 'Privacy & data'],
];

export function AppSidebar({ active, className = '' }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  async function logout() {
    const { error: signOutError } = await signOut();
    if (signOutError) { setError('We could not sign you out just now. Please try again.'); return; }
    navigate('/', { replace: true });
  }
  return <aside className={`app-sidebar ${className}`}><Brand/><span className="eyebrow"><SignatureHeart/> Your little space</span>
    <nav>{links.map(([key, to, Icon, label]) => <Link key={key} className={active === key ? 'active' : undefined} to={to}><Icon size={17}/>{label}</Link>)}</nav>
    <Link className="profile-nav" to="/profile"><Settings size={16}/> Profile & skin preferences</Link>
    {error && <p className="form-error" role="alert">{error}</p>}<button className="logout-button" onClick={logout}><LogOut size={16}/> Sign out</button>
  </aside>;
}
