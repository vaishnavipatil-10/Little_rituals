import { Router } from 'express';

export const journalRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const fields = 'id, user_id, entry_date, skin_rating, skin_condition, mood, sleep_hours, concerns, notes, tags, created_at, updated_at';

function validDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function invalid(res, message = 'Check your journal entry and try again.') {
  return res.status(400).json({ error: { code: 'INVALID_JOURNAL_ENTRY', message } });
}

function fail(res, error) {
  console.error('Journal request failed', error);
  return res.status(500).json({ error: { code: 'JOURNAL_REQUEST_FAILED', message: 'Your journal could not be saved. Please try again.' } });
}

function normalize(body = {}, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enter the journal details and try again.' };
  const result = {};
  const has = (key) => !partial || Object.hasOwn(body, key);
  if (has('entryDate')) {
    if (!validDate(body.entryDate)) return { error: 'Choose a valid journal date.' };
    result.entry_date = body.entryDate;
  }
  if (has('skinRating')) {
    const value = body.skinRating === '' || body.skinRating == null ? null : Number(body.skinRating);
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 5)) return { error: 'Skin rating must be a whole number from 1 to 5.' };
    result.skin_rating = value;
  }
  for (const [source, target, max] of [['skinCondition', 'skin_condition', 240], ['mood', 'mood', 80], ['notes', 'notes', 5000]]) {
    if (!has(source)) continue;
    const value = body[source] == null || body[source] === '' ? null : body[source];
    if (value !== null && (typeof value !== 'string' || value.length > max)) return { error: `${source === 'skinCondition' ? 'Skin condition' : source[0].toUpperCase() + source.slice(1)} must be ${max} characters or fewer.` };
    result[target] = typeof value === 'string' ? value.trim() || null : null;
  }
  if (has('sleepHours')) {
    const value = body.sleepHours === '' || body.sleepHours == null ? null : Number(body.sleepHours);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 24 || Math.round(value * 100) !== value * 100)) return { error: 'Sleep hours must be between 0 and 24, with up to two decimal places.' };
    result.sleep_hours = value;
  }
  for (const [source, target] of [['concerns', 'concerns'], ['tags', 'tags']]) {
    if (!has(source)) continue;
    const value = body[source] ?? [];
    if (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== 'string' || item.trim().length > 80)) return { error: `${source === 'concerns' ? 'Concerns' : 'Tags'} must be a list of up to 30 short notes.` };
    result[target] = value.map((item) => item.trim()).filter(Boolean);
  }
  return { value: result };
}

journalRouter.get('/', async (req, res) => {
  const { from, to } = req.query;
  if ((from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) return invalid(res, 'Choose a valid journal date range.');
  let query = req.supabase.from('journal_entries').select(fields).eq('user_id', req.user.id).order('entry_date', { ascending: false }).limit(120);
  if (from) query = query.gte('entry_date', from);
  if (to) query = query.lte('entry_date', to);
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  if (search) query = query.ilike('notes', `%${search.replace(/[%_]/g, '\\$&')}%`);
  const { data, error } = await query;
  if (error) return fail(res, error);
  return res.json({ entries: data || [] });
});

journalRouter.post('/', async (req, res) => {
  const normalized = normalize(req.body);
  if (normalized.error) return invalid(res, normalized.error);
  const { data, error } = await req.supabase.from('journal_entries').insert({ user_id: req.user.id, ...normalized.value }).select(fields).single();
  if (error) return error.code === '23505' ? res.status(409).json({ error: { code: 'ENTRY_EXISTS', message: 'There is already a journal entry for that date. Open it to make changes.' } }) : fail(res, error);
  return res.status(201).json({ entry: data });
});

journalRouter.patch('/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return invalid(res, 'That journal entry link is not valid.');
  const normalized = normalize(req.body, true);
  if (normalized.error) return invalid(res, normalized.error);
  if (!Object.keys(normalized.value).length) return invalid(res, 'Change an entry detail before saving.');
  const { data, error } = await req.supabase.from('journal_entries').update(normalized.value).eq('id', req.params.id).eq('user_id', req.user.id).select(fields).maybeSingle();
  if (error) return error.code === '23505' ? res.status(409).json({ error: { code: 'ENTRY_EXISTS', message: 'There is already a journal entry for that date.' } }) : fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'ENTRY_NOT_FOUND', message: 'We could not find that journal entry.' } });
  return res.json({ entry: data });
});

journalRouter.delete('/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return invalid(res, 'That journal entry link is not valid.');
  const { data, error } = await req.supabase.from('journal_entries').delete().eq('id', req.params.id).eq('user_id', req.user.id).select('id').maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'ENTRY_NOT_FOUND', message: 'We could not find that journal entry.' } });
  return res.json({ deleted: true });
});
