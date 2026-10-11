import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { api } from '../services/api.js';
import '../styles/profile.css';

const skinTypes = ['oily','dry','combination','sensitive','normal'];
const concernsList = ['acne','dryness','oiliness','redness','dark spots','pigmentation'];
const goalList = ['hydration','sunscreen consistency','routine consistency'];
const labelize = (value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [skin, setSkin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileBusy, setProfileBusy] = useState(false);
  const [skinBusy, setSkinBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/profile'), api.get('/profile/skin')]).then(([profileResult, skinResult]) => {
      if (!active) return;
      setProfile({ displayName: profileResult.data.profile.display_name || '' });
      setSkin({ skinType: skinResult.data.skinProfile.skin_type || '', concerns: skinResult.data.skinProfile.concerns || [], avoidIngredients: skinResult.data.skinProfile.avoid_ingredients || [], goals: skinResult.data.skinProfile.goals || [] });
    }).catch((err) => { if (active) setError(err.response?.data?.error?.message || 'We could not load your profile. Please refresh and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveProfile(event) {
    event.preventDefault(); setProfileBusy(true); setError(''); setNotice('');
    try { const result = await api.patch('/profile', profile); setProfile({ displayName: result.data.profile.display_name }); setNotice('Your profile has been saved.'); }
    catch (err) { setError(err.response?.data?.error?.message || 'Your profile could not be saved. Please try again.'); }
    finally { setProfileBusy(false); }
  }
  async function saveSkin(event) {
    event.preventDefault(); setSkinBusy(true); setError(''); setNotice('');
    try { const result = await api.patch('/profile/skin', skin); const saved = result.data.skinProfile; setSkin({ skinType: saved.skin_type || '', concerns: saved.concerns || [], avoidIngredients: saved.avoid_ingredients || [], goals: saved.goals || [] }); setNotice('Your skin preferences have been saved.'); }
    catch (err) { setError(err.response?.data?.error?.message || 'Your skin preferences could not be saved. Please try again.'); }
    finally { setSkinBusy(false); }
  }
  function toggle(field, value) { setSkin((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] })); }

  return <main className="profile-page"><Link className="text-link back-link" to="/dashboard"><ArrowLeft size={16}/> Back to your space</Link><span className="eyebrow">A little about you</span><h1>Your profile</h1><p className="profile-intro">Keep the details that help Little Rituals feel like your own. These preferences stay private.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-success" role="status"><Check size={16}/>{notice}</p>}
    {loading?<p className="loading-copy">Opening your profile…</p>:profile&&skin&&<>
      <form className="profile-card" onSubmit={saveProfile}><h2>Your details</h2><p>Choose how we greet you in your personal space.</p><label>Display name<input maxLength={80} required value={profile.displayName} onChange={(e)=>setProfile({displayName:e.target.value})}/></label><button className="button button-primary" disabled={profileBusy}>{profileBusy?'Saving…':'Save profile'}</button></form>
      <form className="profile-card" onSubmit={saveSkin}><h2>Skin preferences</h2><p>These are your own observations, not a diagnosis.</p><fieldset><legend>Skin type</legend><div className="choice-row">{skinTypes.map((type)=><label className="choice" key={type}><input type="radio" name="skinType" checked={skin.skinType===type} onChange={()=>setSkin({...skin,skinType:type})}/><span>{labelize(type)}</span></label>)}</div><button type="button" className="quiet-clear" onClick={()=>setSkin({...skin,skinType:''})}>Clear selection</button></fieldset>
        <fieldset><legend>Things you notice</legend><div className="choice-row">{concernsList.map((item)=><label className="choice" key={item}><input type="checkbox" checked={skin.concerns.includes(item)} onChange={()=>toggle('concerns',item)}/><span>{labelize(item)}</span></label>)}</div></fieldset>
        <label>Ingredients you prefer to avoid<textarea rows="3" placeholder="For example: fragrance, if you choose to avoid it" value={skin.avoidIngredients.join(', ')} onChange={(e)=>setSkin({...skin,avoidIngredients:e.target.value.split(',').map((x)=>x.trim()).filter(Boolean)})}/></label>
        <fieldset><legend>Your personal goals</legend><div className="choice-row">{goalList.map((item)=><label className="choice" key={item}><input type="checkbox" checked={skin.goals.includes(item)} onChange={()=>toggle('goals',item)}/><span>{labelize(item)}</span></label>)}</div></fieldset>
        <button className="button button-primary" disabled={skinBusy}>{skinBusy?'Saving…':'Save skin preferences'}</button>
      </form>
    </>}
    <p className="profile-disclaimer">Little Rituals supports personal tracking and education. It does not diagnose or treat skin conditions.</p>
  </main>;
}
