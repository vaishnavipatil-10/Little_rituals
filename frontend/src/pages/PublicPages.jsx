import { Link } from 'react-router-dom';
import { ArrowRight, Droplets, Flower2, Heart, Leaf, ShieldCheck, Sparkles } from 'lucide-react';
import { Brand } from '../components/Brand.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';

const features = [
  [Flower2, 'Routines that feel like yours', 'Keep your morning and evening steps in one calm, easy place.'],
  [Leaf, 'Ingredients, made clearer', 'Explore thoughtful, curated notes about the ingredients in your products.'],
  [Droplets, 'Gentle daily check-ins', 'Track water, skin changes and the small habits that add up over time.'],
  [Heart, 'A journal without judgement', 'Make a private note about how your skin and your day are feeling.'],
];

export function LandingPage() {
  return <div className="public-page">
    <header className="site-nav"><Brand/><nav><a href="#features">Explore the Features</a><a href="#how">How It Works</a></nav><div className="nav-actions"><Link className="text-link" to="/login">Login</Link><Link className="button button-small" to="/register">Get Started</Link></div></header>
    <main>
      <section className="hero"><div className="hero-copy"><span className="eyebrow"><SignatureHeart/> A softer kind of self-care</span><h1>Your little rituals.<br/><em>Your softer everyday.</em></h1><p>A cozy home for your skincare routine, ingredient notes, and the little check-ins that help you care for yourself.</p><div className="hero-actions"><Link className="button button-primary" to="/register">Start Your Ritual <ArrowRight size={17}/></Link><a className="button button-quiet" href="#features">Explore the Features</a></div><div className="hero-footnote"><ShieldCheck size={16}/> Private by design. Always your pace.</div></div>
      <div className="ritual-art"><img src="/self-care-journal.svg" alt="An open self-care journal with a gentle routine checklist, moisturizer, and botanical sprig"/><SignatureHeart className="art-heart art-heart-one"/><SignatureHeart className="art-heart art-heart-two"/></div></section>
      <section className="feature-section" id="features"><div className="section-heading"><span className="eyebrow">A small space for a lot of care</span><h2>Care that meets you where you are.</h2><p>Keep the useful things together, without turning self-care into another thing to get perfect.</p></div><div className="feature-grid">{features.map(([Icon,title,text])=><article className="feature-card" key={title}><span className="feature-icon"><Icon size={20}/></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="how-section" id="how"><div className="how-art"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><Sparkles className="how-spark" size={26}/><Flower2 className="how-flower" size={94} strokeWidth={1}/><span>little, by little</span></div><div className="how-copy"><span className="eyebrow">A gentle beginning</span><h2>Make room for what matters.</h2><ol><li><b>Gather your products.</b><span>Start with the things already on your shelf.</span></li><li><b>Shape a routine.</b><span>Put your own steps in an order that feels good.</span></li><li><b>Notice the little things.</b><span>Keep a private record of how your habits and skin feel.</span></li></ol></div></section>
      <section className="privacy-strip"><ShieldCheck size={23}/><p><strong>Your care is personal.</strong> Cycle tracking is optional, your journal stays private, and Little Rituals is here for reflection — never diagnosis.</p><Link to="/explore">Our approach <ArrowRight size={15}/></Link></section>
      <section className="final-cta"><span className="eyebrow"><SignatureHeart/> No perfect routines required</span><h2>Start with one small thing.</h2><p>A little more care can begin right where you are.</p><Link className="button button-primary" to="/register">Start Your Ritual <ArrowRight size={17}/></Link></section>
    </main>
    <footer className="site-footer"><Brand/><p>Small things. Soft moments. A little more care for you.</p><div><Link to="/explore">Explore</Link><Link to="/login">Login</Link><Link to="/register">Get Started</Link></div><small>Little Rituals is for personal tracking and education, not medical diagnosis or treatment.</small></footer>
  </div>;
}

export function ExplorePage() { return <main className="simple-page"><Brand/><span className="eyebrow">Explore skincare</span><h1>Learn at your own pace.</h1><p>Little Rituals will bring together curated ingredient guides, routine notes, and practical ways to keep track of your own products. Educational information is being prepared with care.</p><Link className="button button-primary" to="/register">Create your space <ArrowRight size={16}/></Link><p className="small-print">Ingredient information is general education and is not medical advice.</p></main>; }

export function NotFoundPage() { return <main className="status-page"><Brand/><span className="eyebrow">A little detour</span><h1>This page wandered off.</h1><Link className="button button-primary" to="/">Back to Little Rituals</Link></main>; }
