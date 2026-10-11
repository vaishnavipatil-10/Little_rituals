import { Router } from 'express';

export const routineRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const routineTypes = new Set(['morning', 'night']);
const routineFields = 'id, user_id, name, routine_type, created_at, updated_at';
const stepFields = 'id, routine_id, product_id, step_type, position, notes, wait_seconds, enabled';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function fail(res, error) {
  console.error('Routine request failed', error);
  return res.status(500).json({ error: { code: 'ROUTINE_REQUEST_FAILED', message: 'Your routine could not be saved. Please try again.' } });
}

function invalid(res, message = 'Check the routine details and try again.') {
  return res.status(400).json({ error: { code: 'INVALID_ROUTINE', message } });
}

async function getOwnedRoutine(req, res, routineId) {
  if (!uuidPattern.test(routineId || '')) { invalid(res, 'That routine link is not valid.'); return null; }
  const { data, error } = await req.supabase.from('routines').select('id').eq('id', routineId).eq('user_id', req.user.id).maybeSingle();
  if (error) { fail(res, error); return null; }
  if (!data) { res.status(404).json({ error: { code: 'ROUTINE_NOT_FOUND', message: 'We could not find that routine.' } }); return null; }
  return data;
}

async function validateProduct(req, res, productId) {
  if (productId == null || productId === '') return null;
  if (typeof productId !== 'string' || !uuidPattern.test(productId)) { invalid(res, 'Choose a valid product from your library.'); return undefined; }
  const { data, error } = await req.supabase.from('products').select('id').eq('id', productId).eq('user_id', req.user.id).maybeSingle();
  if (error) { fail(res, error); return undefined; }
  if (!data) { res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'That product is not in your library.' } }); return undefined; }
  return productId;
}

function normalizeStep(body = {}, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enter the step details and try again.' };
  const result = {};
  if (!partial || Object.hasOwn(body, 'stepType')) {
    const stepType = typeof body.stepType === 'string' ? body.stepType.trim() : '';
    if (!stepType || stepType.length > 80) return { error: 'Step name is required and must be 80 characters or fewer.' };
    result.step_type = stepType;
  }
  if (!partial || Object.hasOwn(body, 'notes')) {
    const notes = body.notes == null || body.notes === '' ? null : body.notes;
    if (notes !== null && (typeof notes !== 'string' || notes.length > 1000)) return { error: 'Step instructions must be 1,000 characters or fewer.' };
    result.notes = typeof notes === 'string' ? notes.trim() || null : null;
  }
  if (!partial || Object.hasOwn(body, 'waitSeconds')) {
    const waitSeconds = body.waitSeconds == null || body.waitSeconds === '' ? null : Number(body.waitSeconds);
    if (waitSeconds !== null && (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 7200)) return { error: 'Wait time must be between 0 and 7,200 seconds.' };
    result.wait_seconds = waitSeconds;
  }
  if (!partial || Object.hasOwn(body, 'enabled')) {
    if (body.enabled != null && typeof body.enabled !== 'boolean') return { error: 'Step enabled state must be true or false.' };
    result.enabled = body.enabled ?? true;
  }
  if (!partial || Object.hasOwn(body, 'productId')) result.product_id = body.productId || null;
  return { value: result };
}

routineRouter.get('/', async (req, res) => {
  const date = req.query.date === undefined ? new Date().toISOString().slice(0, 10) : req.query.date;
  if (!validDate(date)) return invalid(res, 'Choose a valid date for routine progress.');
  const { data: routines, error } = await req.supabase.from('routines').select(routineFields).eq('user_id', req.user.id).order('routine_type').order('created_at');
  if (error) return fail(res, error);
  const ids = (routines || []).map(({ id }) => id);
  if (!ids.length) return res.json({ routines: [], date });
  const [{ data: steps, error: stepError }, { data: completions, error: completionError }] = await Promise.all([
    req.supabase.from('routine_steps').select(stepFields).in('routine_id', ids).order('position'),
    req.supabase.from('routine_completions').select('routine_id, completed_on, completed_steps, total_steps, completed_at').eq('user_id', req.user.id).eq('completed_on', date).in('routine_id', ids),
  ]);
  if (stepError) return fail(res, stepError);
  if (completionError) return fail(res, completionError);
  return res.json({ routines: routines.map((routine) => ({
    ...routine,
    steps: (steps || []).filter((step) => step.routine_id === routine.id),
    completion: (completions || []).find((completion) => completion.routine_id === routine.id) || null,
  })), date });
});

routineRouter.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const routineType = req.body?.routineType;
  if (!name || name.length > 100 || !routineTypes.has(routineType)) return invalid(res, 'Add a name of 1–100 characters and choose morning or evening.');
  const { data, error } = await req.supabase.from('routines').insert({ user_id: req.user.id, name, routine_type: routineType }).select(routineFields).single();
  if (error) return error.code === '23505' ? res.status(409).json({ error: { code: 'ROUTINE_EXISTS', message: 'A routine with that name already exists for this time of day.' } }) : fail(res, error);
  return res.status(201).json({ routine: { ...data, steps: [], completion: null } });
});

routineRouter.patch('/:routineId', async (req, res) => {
  const routine = await getOwnedRoutine(req, res, req.params.routineId);
  if (!routine) return;
  const updates = {};
  if (Object.hasOwn(req.body || {}, 'name')) {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) return invalid(res, 'Routine name is required and must be 100 characters or fewer.');
    updates.name = name;
  }
  if (Object.hasOwn(req.body || {}, 'routineType')) {
    if (!routineTypes.has(req.body.routineType)) return invalid(res, 'Choose morning or evening.');
    updates.routine_type = req.body.routineType;
  }
  if (!Object.keys(updates).length) return invalid(res, 'Change a name or time of day before saving.');
  const { data, error } = await req.supabase.from('routines').update(updates).eq('id', routine.id).eq('user_id', req.user.id).select(routineFields).maybeSingle();
  if (error) return error.code === '23505' ? res.status(409).json({ error: { code: 'ROUTINE_EXISTS', message: 'A routine with that name already exists for this time of day.' } }) : fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'ROUTINE_NOT_FOUND', message: 'We could not find that routine.' } });
  return res.json({ routine: data });
});

routineRouter.delete('/:routineId', async (req, res) => {
  const routine = await getOwnedRoutine(req, res, req.params.routineId);
  if (!routine) return;
  const { data, error } = await req.supabase.from('routines').delete().eq('id', routine.id).eq('user_id', req.user.id).select('id').maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'ROUTINE_NOT_FOUND', message: 'We could not find that routine.' } });
  return res.json({ deleted: true });
});

routineRouter.post('/:routineId/steps', async (req, res) => {
  const routine = await getOwnedRoutine(req, res, req.params.routineId);
  if (!routine) return;
  const normalized = normalizeStep(req.body);
  if (normalized.error) return invalid(res, normalized.error);
  const productId = await validateProduct(req, res, normalized.value.product_id);
  if (productId === undefined) return;
  const { data: steps, error: stepsError } = await req.supabase.from('routine_steps').select('id, position').eq('routine_id', routine.id).order('position');
  if (stepsError) return fail(res, stepsError);
  if (steps.length >= 100) return res.status(409).json({ error: { code: 'ROUTINE_STEP_LIMIT', message: 'A routine can contain up to 100 steps.' } });
  const position = Math.max(-1, ...steps.map((step) => step.position)) + 1;
  if (position > 32767) return res.status(409).json({ error: { code: 'ROUTINE_ORDER_LIMIT', message: 'This routine has reached its step-order limit.' } });
  const { data, error } = await req.supabase.from('routine_steps').insert({ routine_id: routine.id, position, ...normalized.value }).select(stepFields).single();
  if (error) return fail(res, error);
  return res.status(201).json({ step: data });
});

routineRouter.put('/:routineId/steps/order', async (req, res) => {
  const routine = await getOwnedRoutine(req, res, req.params.routineId);
  if (!routine) return;
  const ids = req.body?.stepIds;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !uuidPattern.test(id)) || new Set(ids).size !== ids.length) return invalid(res, 'Choose each step once to save its order.');
  const { data: steps, error } = await req.supabase.from('routine_steps').select('id, position').eq('routine_id', routine.id).order('position');
  if (error) return fail(res, error);
  if (steps.length !== ids.length || ids.some((id) => !steps.some((step) => step.id === id))) return invalid(res, 'The step list changed. Refresh and try again.');
  const highest = Math.max(-1, ...steps.map((step) => step.position));
  const temporaryStart = highest + steps.length + 1;
  if (temporaryStart + steps.length > 32767) return res.status(409).json({ error: { code: 'ROUTINE_ORDER_LIMIT', message: 'This routine cannot be reordered safely. Please contact support.' } });
  for (let index = 0; index < steps.length; index += 1) {
    const { error: updateError } = await req.supabase.from('routine_steps').update({ position: temporaryStart + index }).eq('routine_id', routine.id).eq('id', steps[index].id);
    if (updateError) return fail(res, updateError);
  }
  for (let position = 0; position < ids.length; position += 1) {
    const { error: updateError } = await req.supabase.from('routine_steps').update({ position }).eq('routine_id', routine.id).eq('id', ids[position]);
    if (updateError) return fail(res, updateError);
  }
  const { data: ordered, error: readError } = await req.supabase.from('routine_steps').select(stepFields).eq('routine_id', routine.id).order('position');
  if (readError) return fail(res, readError);
  return res.json({ steps: ordered || [] });
});

routineRouter.patch('/:routineId/steps/:stepId', async (req, res) => {
  const routine = await getOwnedRoutine(req, res, req.params.routineId);
  if (!routine) return;
  if (!uuidPattern.test(req.params.stepId)) return invalid(res, 'That step link is not valid.');
  const normalized = normalizeStep(req.body, { partial: true });
  if (normalized.error) return invalid(res, normalized.error);
  if (!Object.keys(normalized.value).length) return invalid(res, 'Change a step detail before saving.');
  if (Object.hasOwn(normalized.value, 'product_id')) {
    const productId = await validateProduct(req, res, normalized.value.product_id);
    if (productId === undefined) return;
  }
  const { data, error } = await req.supabase.from('routine_steps').update(normalized.value).eq('routine_id', routine.id).eq('id', req.params.stepId).select(stepFields).maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'ROUTINE_STEP_NOT_FOUND', message: 'We could not find that step.' } });
  return res.json({ step: data });
});

routineRouter.delete('/:routineId/steps/:stepId', async (req, res) => {
  const routine = await getOwnedRoutine(req, res, req.params.routineId);
  if (!routine) return;
  if (!uuidPattern.test(req.params.stepId)) return invalid(res, 'That step link is not valid.');
  const { data, error } = await req.supabase.from('routine_steps').delete().eq('routine_id', routine.id).eq('id', req.params.stepId).select('id').maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'ROUTINE_STEP_NOT_FOUND', message: 'We could not find that step.' } });
  return res.json({ deleted: true });
});

routineRouter.put('/:routineId/completion', async (req, res) => {
  const routine = await getOwnedRoutine(req, res, req.params.routineId);
  if (!routine) return;
  const date = req.body?.date;
  const completedSteps = req.body?.completedSteps;
  if (!validDate(date) || !Number.isInteger(completedSteps) || completedSteps < 0) return invalid(res, 'Choose a valid day and completion count.');
  const { data: steps, error: stepError } = await req.supabase.from('routine_steps').select('id').eq('routine_id', routine.id).eq('enabled', true);
  if (stepError) return fail(res, stepError);
  const totalSteps = steps.length;
  if (completedSteps > totalSteps) return invalid(res, 'Completed steps cannot exceed the routine step count.');
  const { data, error } = await req.supabase.from('routine_completions').upsert({
    user_id: req.user.id, routine_id: routine.id, completed_on: date, completed_steps: completedSteps, total_steps: totalSteps,
  }, { onConflict: 'routine_id,completed_on' }).select('routine_id, completed_on, completed_steps, total_steps, completed_at').single();
  if (error) return fail(res, error);
  return res.json({ completion: data });
});
