import { Router } from 'express';

export const waterRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/i;

function fail(res, error) {
  console.error('Water tracker request failed', error);
  return res.status(500).json({ error: { code: 'WATER_REQUEST_FAILED', message: 'Your water tracker could not be updated. Please try again.' } });
}

function invalid(res, message = 'Check the water details and try again.') {
  return res.status(400).json({ error: { code: 'INVALID_WATER_ENTRY', message } });
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !isoDateTimePattern.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() !== 'Invalid Date';
}

function readAmount(value) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 1 && amount <= 5000 ? amount : null;
}

waterRouter.get('/', async (req, res) => {
  const { startAt, endAt } = req.query;
  if (!validTimestamp(startAt) || !validTimestamp(endAt) || Date.parse(startAt) >= Date.parse(endAt) || Date.parse(endAt) - Date.parse(startAt) > 26 * 60 * 60 * 1000) {
    return invalid(res, 'Choose the start and end of your local day.');
  }
  const [{ data: entries, error: entryError }, { data: settings, error: settingsError }] = await Promise.all([
    req.supabase.from('water_entries').select('id, amount_ml, logged_at').eq('user_id', req.user.id).gte('logged_at', new Date(Date.parse(startAt)).toISOString()).lt('logged_at', new Date(Date.parse(endAt)).toISOString()).order('logged_at', { ascending: false }),
    req.supabase.from('user_settings').select('water_goal_ml, volume_unit').eq('user_id', req.user.id).maybeSingle(),
  ]);
  if (entryError) return fail(res, entryError);
  if (settingsError) return fail(res, settingsError);
  const data = entries || [];
  return res.json({ entries: data, totalMl: data.reduce((total, entry) => total + entry.amount_ml, 0), goalMl: settings?.water_goal_ml ?? 2000, volumeUnit: settings?.volume_unit ?? 'ml' });
});

waterRouter.patch('/goal', async (req, res) => {
  const goalMl = Number(req.body?.goalMl);
  if (!Number.isInteger(goalMl) || goalMl < 250 || goalMl > 10000) return invalid(res, 'Choose a daily goal between 250 and 10,000 ml.');
  const { data, error } = await req.supabase.from('user_settings').upsert({ user_id: req.user.id, water_goal_ml: goalMl }).select('water_goal_ml, volume_unit').single();
  if (error) return fail(res, error);
  return res.json({ goalMl: data.water_goal_ml, volumeUnit: data.volume_unit });
});

waterRouter.post('/', async (req, res) => {
  const amount = readAmount(req.body?.amountMl);
  const loggedAt = req.body?.loggedAt;
  if (amount === null) return invalid(res, 'Water amount must be a whole number between 1 and 5,000 ml.');
  if (loggedAt !== undefined && !validTimestamp(loggedAt)) return invalid(res, 'Choose a valid time for this water entry.');
  const entry = { user_id: req.user.id, amount_ml: amount, ...(loggedAt ? { logged_at: new Date(Date.parse(loggedAt)).toISOString() } : {}) };
  const { data, error } = await req.supabase.from('water_entries').insert(entry).select('id, amount_ml, logged_at').single();
  if (error) return fail(res, error);
  return res.status(201).json({ entry: data });
});

waterRouter.patch('/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return invalid(res, 'That water entry link is not valid.');
  const amount = readAmount(req.body?.amountMl);
  if (amount === null) return invalid(res, 'Water amount must be a whole number between 1 and 5,000 ml.');
  const { data, error } = await req.supabase.from('water_entries').update({ amount_ml: amount }).eq('id', req.params.id).eq('user_id', req.user.id).select('id, amount_ml, logged_at').maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'WATER_ENTRY_NOT_FOUND', message: 'We could not find that water entry.' } });
  return res.json({ entry: data });
});

waterRouter.delete('/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return invalid(res, 'That water entry link is not valid.');
  const { data, error } = await req.supabase.from('water_entries').delete().eq('id', req.params.id).eq('user_id', req.user.id).select('id').maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'WATER_ENTRY_NOT_FOUND', message: 'We could not find that water entry.' } });
  return res.json({ deleted: true });
});
