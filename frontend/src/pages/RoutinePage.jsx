import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { SignatureHeart } from '../components/SignatureHeart.jsx';
import { api } from '../services/api.js';
import '../styles/daily.css';

const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const messageOf = (error, fallback) => error.response?.data?.error?.message || fallback;

export function RoutinePage() {
  const [date, setDate] = useState(localDate());
  const [routines, setRoutines] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newRoutine, setNewRoutine] = useState({ name: '', routineType: 'morning' });
  const [editing, setEditing] = useState(null);
  const [editingStep, setEditingStep] = useState(null);
  const [stepDrafts, setStepDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [routineResponse, productResponse] = await Promise.all([api.get(`/routines?date=${date}`), api.get('/products')]);
      setRoutines(routineResponse.data.routines || []);
      setProducts(productResponse.data.products || []);
    } catch (requestError) { setError(messageOf(requestError, 'Your routines could not be loaded. Check that the API is running and try again.')); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  const productNames = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  async function createRoutine(event) {
    event.preventDefault(); setBusy('create'); setError(''); setNotice('');
    try {
      await api.post('/routines', newRoutine);
      setNewRoutine({ ...newRoutine, name: '' }); setNotice('Your little routine is ready. ♡'); await load();
    } catch (requestError) { setError(messageOf(requestError, 'Your routine could not be saved.')); }
    finally { setBusy(''); }
  }
  async function saveRoutine(event) {
    event.preventDefault(); if (!editing) return;
    setBusy(`routine-${editing.id}`); setError('');
    try { await api.patch(`/routines/${editing.id}`, editing); setEditing(null); setNotice('Routine details saved. ♡'); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'Routine details could not be saved.')); }
    finally { setBusy(''); }
  }
  async function deleteRoutine(routine) {
    if (!window.confirm(`Delete “${routine.name}” and its saved steps?`)) return;
    setBusy(`routine-${routine.id}`); setError('');
    try { await api.delete(`/routines/${routine.id}`); setNotice('Routine removed.'); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'Routine could not be deleted.')); }
    finally { setBusy(''); }
  }
  async function addStep(event, routine) {
    event.preventDefault(); const draft = stepDrafts[routine.id] || { stepType: '', notes: '', productId: '', waitSeconds: '' };
    setBusy(`step-${routine.id}`); setError('');
    try {
      await api.post(`/routines/${routine.id}/steps`, { ...draft, productId: draft.productId || null, waitSeconds: draft.waitSeconds === '' ? null : Number(draft.waitSeconds) });
      setStepDrafts((all) => ({ ...all, [routine.id]: { stepType: '', notes: '', productId: '', waitSeconds: '' } })); setNotice('Step added to your routine. ♡'); await load();
    } catch (requestError) { setError(messageOf(requestError, 'The routine step could not be saved.')); }
    finally { setBusy(''); }
  }
  async function removeStep(routine, step) {
    if (!window.confirm(`Remove “${step.step_type}” from this routine?`)) return;
    setBusy(`step-${routine.id}`); setError('');
    try { await api.delete(`/routines/${routine.id}/steps/${step.id}`); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'The routine step could not be removed.')); }
    finally { setBusy(''); }
  }
  async function saveStep(event, routine) {
    event.preventDefault(); if (!editingStep) return;
    setBusy(`step-${routine.id}`); setError('');
    try {
      await api.patch(`/routines/${routine.id}/steps/${editingStep.id}`, {
        stepType: editingStep.stepType, notes: editingStep.notes, productId: editingStep.productId || null,
        waitSeconds: editingStep.waitSeconds === '' ? null : Number(editingStep.waitSeconds), enabled: editingStep.enabled,
      });
      setEditingStep(null); setNotice('Routine step saved. ♡'); await load();
    } catch (requestError) { setError(messageOf(requestError, 'Routine step could not be saved.')); }
    finally { setBusy(''); }
  }
  async function reorder(routine, index, delta) {
    const next = [...routine.steps]; const target = index + delta;
    if (target < 0 || target >= next.length || (routine.completion?.completed_steps || 0) > 0) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(`order-${routine.id}`); setError('');
    try { await api.put(`/routines/${routine.id}/steps/order`, { stepIds: next.map((step) => step.id) }); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'Step order could not be saved.')); }
    finally { setBusy(''); }
  }
  async function saveProgress(routine, completedSteps) {
    setBusy(`completion-${routine.id}`); setError(''); setNotice('');
    try { await api.put(`/routines/${routine.id}/completion`, { date, completedSteps }); setNotice(completedSteps === routine.steps.filter((step) => step.enabled).length && completedSteps > 0 ? 'A little care, all done for this day. ♡' : 'Step progress saved. ♡'); await load(); }
    catch (requestError) { setError(messageOf(requestError, 'Daily progress could not be saved.')); }
    finally { setBusy(''); }
  }

  return <div className="app-shell daily-shell"><AppSidebar active="routine" className="daily-sidebar"/><main className="daily-main">
    <header className="daily-heading"><span className="eyebrow"><SignatureHeart/> A rhythm that feels like yours</span><h1>My Routines</h1><p>Keep your morning and evening steps gentle, personal, and easy to return to.</p></header>
    {error && <p className="daily-alert" role="alert">{error}</p>}{notice && <p className="daily-notice" role="status">{notice}</p>}
    <section className="daily-panel routine-create"><div><span className="daily-kicker">Begin with a small ritual</span><h2>Create a routine</h2><p>Name this ritual, then add the steps that make it yours.</p></div>
      <form className="daily-form-inline" onSubmit={createRoutine}><label>Routine name<input value={newRoutine.name} onChange={(event) => setNewRoutine({ ...newRoutine, name: event.target.value })} maxLength={100} required placeholder="My soft morning"/></label><label>Time of day<select value={newRoutine.routineType} onChange={(event) => setNewRoutine({ ...newRoutine, routineType: event.target.value })}><option value="morning">Morning · AM</option><option value="night">Evening · PM</option></select></label><button className="button button-primary" disabled={busy === 'create'}><Plus size={16}/>{busy === 'create' ? 'Creating…' : 'Create routine'}</button></form>
    </section>
    <div className="daily-toolbar"><label>Progress date<input type="date" value={date} max={localDate()} onChange={(event) => setDate(event.target.value)}/></label><button className="daily-text-button" type="button" onClick={load}>Refresh</button></div>
    {loading ? <div className="daily-state" role="status">Gathering your rituals… ♡</div> : routines.length === 0 ? <div className="daily-state daily-empty"><span className="empty-heart">♡</span><h2>Your routine shelf is ready</h2><p>Create a morning or evening routine above, then add steps that work for you.</p></div> : <div className="routine-grid">{routines.map((routine) => {
      const activeSteps = routine.steps.filter((step) => step.enabled);
      const completed = Math.min(routine.completion?.completed_steps || 0, activeSteps.length);
      const draft = stepDrafts[routine.id] || { stepType: '', notes: '', productId: '', waitSeconds: '' };
      return <article className="daily-panel routine-card" key={routine.id}>
        <header className="routine-card-heading"><span className="routine-time">{routine.routine_type === 'morning' ? '☼ Morning · AM' : '☾ Evening · PM'}</span><div className="routine-actions"><button type="button" className="daily-icon-button" aria-label={`Edit ${routine.name}`} onClick={() => setEditing({ id: routine.id, name: routine.name, routineType: routine.routine_type })}>Edit</button><button type="button" className="daily-icon-button danger" aria-label={`Delete ${routine.name}`} onClick={() => deleteRoutine(routine)} disabled={busy === `routine-${routine.id}`}><Trash2 size={16}/></button></div></header>
        {editing?.id === routine.id ? <form className="daily-form" onSubmit={saveRoutine}><label>Routine name<input required maxLength={100} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })}/></label><label>Time of day<select value={editing.routineType} onChange={(event) => setEditing({ ...editing, routineType: event.target.value })}><option value="morning">Morning · AM</option><option value="night">Evening · PM</option></select></label><div className="form-actions"><button className="button button-primary" disabled={busy === `routine-${routine.id}`}>Save</button><button type="button" className="button button-soft" onClick={() => setEditing(null)}>Cancel</button></div></form> : <h2>{routine.name}</h2>}
        <div className="routine-progress"><span>{completed} of {activeSteps.length} steps today</span><div className="progress-track"><span style={{ width: `${activeSteps.length ? completed / activeSteps.length * 100 : 0}%` }}/></div></div>
        {activeSteps.length > 0 && <p className="routine-step-hint">Complete each step in order. Tap the outlined check beside the next step.</p>}
        {routine.steps.length ? <ol className="routine-steps">{routine.steps.map((step) => {
          const index = activeSteps.findIndex((item) => item.id === step.id); const isDone = index >= 0 && index < completed; const isNext = index === completed;
          const canToggle = step.enabled && (isDone || isNext);
          return <li className={`${isDone ? 'step-done' : ''} ${!step.enabled ? 'step-disabled' : ''}`} key={step.id}>
            <div className="step-check-wrap">{step.enabled ? <button type="button" className={`step-check ${isDone ? 'checked' : ''} ${!canToggle ? 'step-check-locked' : ''}`} aria-label={canToggle ? (isDone ? `Undo ${step.step_type}` : `Mark ${step.step_type} complete`) : `Complete the previous steps before ${step.step_type}`} aria-pressed={isDone} title={canToggle ? (isDone ? 'Undo this completed step' : 'Mark this step complete') : 'Complete the previous steps first'} onClick={() => canToggle && saveProgress(routine, isDone ? index : index + 1)} disabled={!canToggle || busy === `completion-${routine.id}`}><Check size={15}/></button> : <span className="step-check static-check" aria-hidden="true">–</span>}</div>
            <div className="step-copy"><strong>{step.step_type}</strong>{step.product_id && productNames.has(step.product_id) && <span>{productNames.get(step.product_id).name}{productNames.get(step.product_id).brand ? ` · ${productNames.get(step.product_id).brand}` : ''}</span>}{step.notes && <p>{step.notes}</p>}{step.wait_seconds > 0 && <small>Wait {Math.floor(step.wait_seconds / 60)} min{step.wait_seconds % 60 ? ` ${step.wait_seconds % 60} sec` : ''}</small>}</div>
            <div className="step-controls"><button type="button" aria-label={`Move ${step.step_type} up`} onClick={() => reorder(routine, index, -1)} disabled={index <= 0 || completed > 0 || busy === `order-${routine.id}`}><ArrowUp size={15}/></button><button type="button" aria-label={`Move ${step.step_type} down`} onClick={() => reorder(routine, index, 1)} disabled={index === routine.steps.length - 1 || completed > 0 || busy === `order-${routine.id}`}><ArrowDown size={15}/></button><button type="button" aria-label={`Edit ${step.step_type}`} onClick={() => setEditingStep({ id: step.id, routineId: routine.id, stepType: step.step_type, notes: step.notes || '', productId: step.product_id || '', waitSeconds: step.wait_seconds ?? '', enabled: step.enabled })}><Pencil size={14}/></button><button type="button" aria-label={`Remove ${step.step_type}`} onClick={() => removeStep(routine, step)} disabled={busy === `step-${routine.id}`}><Trash2 size={15}/></button></div>
          </li>;
        })}</ol> : <p className="routine-no-steps">Add your first step below to begin.</p>}
        {editingStep?.routineId === routine.id && <form className="step-edit-form" onSubmit={(event) => saveStep(event, routine)}><h3>Edit step</h3><label>Step name<input required maxLength={80} value={editingStep.stepType} onChange={(event) => setEditingStep({ ...editingStep, stepType: event.target.value })}/></label><label>Product<select value={editingStep.productId} onChange={(event) => setEditingStep({ ...editingStep, productId: event.target.value })}><option value="">No product linked</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.brand ? ` · ${product.brand}` : ''}</option>)}</select></label><label>Instructions or note<textarea rows="2" maxLength={1000} value={editingStep.notes} onChange={(event) => setEditingStep({ ...editingStep, notes: event.target.value })}/></label><label>Wait time in seconds<input type="number" min="0" max="7200" value={editingStep.waitSeconds} onChange={(event) => setEditingStep({ ...editingStep, waitSeconds: event.target.value })}/></label><label className="step-enabled"><input type="checkbox" checked={editingStep.enabled} onChange={(event) => setEditingStep({ ...editingStep, enabled: event.target.checked })}/> Include this step in my routine</label><div className="form-actions"><button className="button button-primary" disabled={busy === `step-${routine.id}`}>Save step</button><button type="button" className="button button-soft" onClick={() => setEditingStep(null)}>Cancel</button></div></form>}
        {activeSteps.length > 0 && completed === activeSteps.length && <p className="routine-complete"><SignatureHeart/> Your little ritual is complete for today.</p>}
        {completed > 0 && <p className="routine-order-note">Step order is locked while saved progress for this day exists. Undo completed steps to rearrange.</p>}
        <form className="step-add-form" onSubmit={(event) => addStep(event, routine)}><h3><Plus size={16}/> Add a step</h3><label>Step name<input value={draft.stepType} onChange={(event) => setStepDrafts({ ...stepDrafts, [routine.id]: { ...draft, stepType: event.target.value } })} maxLength={80} required placeholder="Cleanse, moisturize…"/></label><label>Product from your library<select value={draft.productId} onChange={(event) => setStepDrafts({ ...stepDrafts, [routine.id]: { ...draft, productId: event.target.value } })}><option value="">No product linked</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.brand ? ` · ${product.brand}` : ''}</option>)}</select></label><label>Instructions or personal note<textarea rows="2" value={draft.notes} onChange={(event) => setStepDrafts({ ...stepDrafts, [routine.id]: { ...draft, notes: event.target.value } })} maxLength={1000} placeholder="A little reminder for yourself"/></label><label>Optional wait time in seconds<input type="number" min="0" max="7200" value={draft.waitSeconds} onChange={(event) => setStepDrafts({ ...stepDrafts, [routine.id]: { ...draft, waitSeconds: event.target.value } })}/></label><button className="button button-soft" disabled={busy === `step-${routine.id}`}>{busy === `step-${routine.id}` ? 'Adding…' : 'Add step'}</button></form>
      </article>;
    })}</div>}
    <p className="daily-footnote">Progress is stored as a daily completed-step count. Step checkmarks follow the routine order so saved progress remains consistent.</p>
  </main></div>;
}
