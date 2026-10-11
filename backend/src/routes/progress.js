import { Router } from 'express';

export const progressRouter = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ingredientFields = 'id, slug, name, tags, cautions, interactions, guidance, reviewed_at';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function fail(res, error) {
  console.error('Progress request failed', error);
  return res.status(500).json({ error: { code: 'PROGRESS_REQUEST_FAILED', message: 'Your progress could not be loaded. Please try again.' } });
}

progressRouter.get('/', async (req, res) => {
  const today = req.query.today === undefined ? new Date().toISOString().slice(0, 10) : req.query.today;
  const timezoneOffsetMinutes = req.query.timezoneOffsetMinutes === undefined ? 0 : Number(req.query.timezoneOffsetMinutes);
  if (!validDate(today) || !Number.isInteger(timezoneOffsetMinutes) || timezoneOffsetMinutes < -840 || timezoneOffsetMinutes > 840) return res.status(400).json({ error: { code: 'INVALID_PROGRESS_RANGE', message: 'Choose a valid local date and time zone.' } });
  const from = new Date(Date.parse(`${today}T00:00:00.000Z`) - 29 * 86400000).toISOString().slice(0, 10);
  const weekFrom = new Date(Date.parse(`${today}T00:00:00.000Z`) - 6 * 86400000).toISOString().slice(0, 10);
  const waterStart = new Date(Date.parse(`${weekFrom}T00:00:00.000Z`) - timezoneOffsetMinutes * 60000).toISOString();
  const waterEndDate = new Date(Date.parse(`${today}T00:00:00.000Z`) + 86400000);
  const waterEnd = new Date(waterEndDate.getTime() - timezoneOffsetMinutes * 60000).toISOString();
  const [{ data: products, error: productError }, { data: routines, error: routineError }, { data: completions, error: completionError }, { data: journal, error: journalError }, { data: water, error: waterError }, { data: settings, error: settingsError }, { data: skinProfile, error: skinProfileError }] = await Promise.all([
    req.supabase.from('products').select('id, name, brand, category, status, expiry_date, opened_date, pao_months').eq('user_id', req.user.id).order('expiry_date').limit(500),
    req.supabase.from('routines').select('id, name, routine_type').eq('user_id', req.user.id).order('routine_type'),
    req.supabase.from('routine_completions').select('routine_id, completed_on, completed_steps, total_steps').eq('user_id', req.user.id).gte('completed_on', weekFrom).lte('completed_on', today).order('completed_on'),
    req.supabase.from('journal_entries').select('entry_date, skin_rating, mood, sleep_hours').eq('user_id', req.user.id).gte('entry_date', from).lte('entry_date', today).order('entry_date'),
    req.supabase.from('water_entries').select('amount_ml, logged_at').eq('user_id', req.user.id).gte('logged_at', waterStart).lt('logged_at', waterEnd).order('logged_at'),
    req.supabase.from('user_settings').select('water_goal_ml').eq('user_id', req.user.id).maybeSingle(),
    req.supabase.from('skin_profiles').select('goals').eq('user_id', req.user.id).maybeSingle(),
  ]);
  const error = productError || routineError || completionError || journalError || waterError || settingsError || skinProfileError;
  if (error) return fail(res, error);
  const localWater = (water || []).map((entry) => ({ ...entry, entry_date: new Date(Date.parse(entry.logged_at) - timezoneOffsetMinutes * 60000).toISOString().slice(0, 10) }));
  return res.json({
    today, rangeStart: from, timezoneOffsetMinutes,
    products: products || [], routines: routines || [], completions: completions || [],
    journal: journal || [], water: localWater, waterGoalMl: settings?.water_goal_ml ?? 2000, goals: skinProfile?.goals || [],
  });
});

async function getCompatibility(req, res) {
  const rawIds = req.query.productIds ?? req.params.productId ?? '';
  const productIds = typeof rawIds === 'string' ? rawIds.split(',') : [];
  if (!productIds.length || productIds.length > 12 || productIds.some((id) => !uuidPattern.test(id)) || new Set(productIds).size !== productIds.length) return res.status(400).json({ error: { code: 'INVALID_PRODUCT_IDS', message: 'Choose up to 12 different products from your library.' } });
  const { data: products, error: productError } = await req.supabase.from('products').select('id, name, brand').eq('user_id', req.user.id).in('id', productIds);
  if (productError) return fail(res, productError);
  if ((products || []).length !== productIds.length) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'One or more selected products are not in your library.' } });
  const [{ data: links, error: linkError }, { data: profile, error: profileError }] = await Promise.all([
    req.supabase.from('product_ingredients').select('product_id, ingredients(' + ingredientFields + ')').in('product_id', productIds),
    req.supabase.from('skin_profiles').select('avoid_ingredients').eq('user_id', req.user.id).maybeSingle(),
  ]);
  if (linkError) return fail(res, linkError);
  if (profileError) return fail(res, profileError);
  const productById = new Map((products || []).map((product) => [product.id, product]));
  const ingredients = (links || []).filter((link) => link.ingredients).map((link) => ({ ...link.ingredients, productId: link.product_id, productName: productById.get(link.product_id)?.name || '' }));
  const avoid = profile?.avoid_ingredients || [];
  const avoidMatches = ingredients.filter((ingredient) => avoid.some((value) => [ingredient.name, ingredient.slug].some((name) => name.toLocaleLowerCase() === value.toLocaleLowerCase()))).map(({ id, name, productId, productName }) => ({ id, name, productId, productName }));
  const hasRetinoid = ingredients.some((ingredient) => ingredient.tags?.some((tag) => tag.toLocaleLowerCase().includes('retinoid')));
  const hasExfoliant = ingredients.some((ingredient) => ingredient.tags?.some((tag) => tag.toLocaleLowerCase().includes('exfoliant')));
  const spansProducts = new Set(ingredients.filter((ingredient) => ingredient.tags?.some((tag) => tag.toLocaleLowerCase().includes('retinoid') || tag.toLocaleLowerCase().includes('exfoliant'))).map((ingredient) => ingredient.productId)).size > 1;
  const warnings = hasRetinoid && hasExfoliant && spansProducts ? [{
    code: 'POTENTIAL_IRRITATION',
    ingredients: [...new Set(ingredients.filter((ingredient) => ingredient.tags?.some((tag) => tag.toLocaleLowerCase().includes('retinoid') || tag.toLocaleLowerCase().includes('exfoliant'))).map((ingredient) => ingredient.name))],
    message: 'Retinoids and exfoliating ingredients can each irritate skin; using them in separate products may increase the chance of irritation for some people. Consider checking each product label and asking a dermatologist about how to use them together.',
  }] : [];
  return res.json({ products: (products || []).map((product) => ({ ...product, ingredients: ingredients.filter((ingredient) => ingredient.productId === product.id) })), avoidMatches, warnings, linkedIngredientCount: ingredients.length });
}

progressRouter.get('/compatibility', getCompatibility);
progressRouter.get('/compatibility/:productId', getCompatibility);
