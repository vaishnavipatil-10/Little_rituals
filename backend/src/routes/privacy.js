import { Router } from 'express';

export const privacyRouter = Router();

const PAGE_SIZE = 500;
const MAX_PAGES = 200;

async function readAllRows(buildQuery) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    const result = data || [];
    rows.push(...result);
    if (result.length < PAGE_SIZE) return rows;
  }
  throw new Error('Export row limit exceeded.');
}

async function readBatched(table, fields, foreignKey, ids, supabase) {
  const result = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    result.push(...await readAllRows(() => supabase.from(table).select(fields).in(foreignKey, batch)));
  }
  return result;
}

privacyRouter.get('/export', async (req, res) => {
  try {
    const ownerId = req.user.id;
    const [{ data: profile, error: profileError }, { data: skinProfile, error: skinProfileError }, { data: settings, error: settingsError }] = await Promise.all([
      req.supabase.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
      req.supabase.from('skin_profiles').select('*').eq('user_id', ownerId).maybeSingle(),
      req.supabase.from('user_settings').select('*').eq('user_id', ownerId).maybeSingle(),
    ]);
    const singleError = profileError || skinProfileError || settingsError;
    if (singleError) throw singleError;
    const [products, routines, journalEntries, waterEntries] = await Promise.all([
      readAllRows(() => req.supabase.from('products').select('*').eq('user_id', ownerId).order('created_at')),
      readAllRows(() => req.supabase.from('routines').select('*').eq('user_id', ownerId).order('created_at')),
      readAllRows(() => req.supabase.from('journal_entries').select('*').eq('user_id', ownerId).order('entry_date')),
      readAllRows(() => req.supabase.from('water_entries').select('*').eq('user_id', ownerId).order('logged_at')),
    ]);
    const [ingredientLinks, routineSteps, routineCompletions] = await Promise.all([
      readBatched('product_ingredients', '*', 'product_id', products.map(({ id }) => id), req.supabase),
      readBatched('routine_steps', '*', 'routine_id', routines.map(({ id }) => id), req.supabase),
      readAllRows(() => req.supabase.from('routine_completions').select('*').eq('user_id', ownerId).order('completed_on')),
    ]);
    const ingredientIds = [...new Set(ingredientLinks.map(({ ingredient_id }) => ingredient_id))];
    const ingredients = await readBatched('ingredients', 'id, slug, name', 'id', ingredientIds, req.supabase);
    return res.json({
      exportedAt: new Date().toISOString(),
      account: { id: ownerId, email: req.user.email || null },
      profile: profile || null,
      skinProfile: skinProfile || null,
      userSettings: settings || null,
      products,
      productIngredientLinks: ingredientLinks,
      ingredients,
      routines,
      routineSteps,
      routineCompletions,
      journalEntries,
      waterEntries,
    });
  } catch (error) {
    console.error('Private data export failed', error);
    return res.status(500).json({ error: { code: 'EXPORT_FAILED', message: 'Your data export could not be prepared. Please try again.' } });
  }
});
