import { Router } from 'express';

export const productRouter = Router();

const categories = new Set(['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', 'exfoliant', 'mask', 'treatment', 'other']);
const statuses = new Set(['using', 'finished', 'expired', 'irritated']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productFields = 'id, user_id, name, brand, category, image_path, price, currency, ingredients_text, purchase_date, opened_date, expiry_date, pao_months, status, rating, notes, would_repurchase, created_at, updated_at, product_ingredients(ingredient_id, ingredients(id, name, slug))';

function fail(res, error) {
  console.error('Product request failed', error);
  return res.status(500).json({ error: { code: 'PRODUCT_REQUEST_FAILED', message: 'We could not save that product. Please try again.' } });
}

function validDate(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeProduct(body, userId) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Enter the product details and try again.' };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 160) return { error: 'Product name is required and must be 160 characters or fewer.' };
  const brand = body.brand == null || body.brand === '' ? null : typeof body.brand === 'string' ? body.brand.trim() : undefined;
  if (brand === undefined || (brand && brand.length > 120)) return { error: 'Brand must be 120 characters or fewer.' };
  const category = body.category ?? 'other';
  if (!categories.has(category)) return { error: 'Choose a valid product category.' };
  const status = body.status ?? 'using';
  if (!statuses.has(status)) return { error: 'Choose a valid product status.' };
  let imagePath = body.imageUrl ?? body.image_path ?? null;
  if (imagePath === '') imagePath = null;
  if (imagePath !== null) {
    try {
      const image = new URL(imagePath);
      if (!['http:', 'https:'].includes(image.protocol)) throw new Error('Invalid protocol');
      imagePath = image.toString();
    } catch { return { error: 'Image must be a valid HTTP or HTTPS URL.' }; }
  }
  const dates = ['purchaseDate', 'openedDate', 'expiryDate'];
  const normalizedDates = {};
  for (const field of dates) {
    const key = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = body[field] ?? body[key] ?? null;
    if (!validDate(value)) return { error: 'Enter valid purchase, opened, and expiry dates.' };
    normalizedDates[key] = value || null;
  }
  const paoMonths = body.paoMonths === '' || body.paoMonths == null ? null : Number(body.paoMonths);
  if (paoMonths !== null && (!Number.isInteger(paoMonths) || paoMonths < 1 || paoMonths > 60)) return { error: 'Period after opening must be between 1 and 60 months.' };
  const rating = body.rating === '' || body.rating == null ? null : Number(body.rating);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return { error: 'Rating must be a whole number from 1 to 5.' };
  const ingredientsText = body.ingredientsText ?? body.ingredients_text ?? null;
  const notes = body.notes ?? null;
  const price = body.price === '' || body.price == null ? null : Number(body.price);
  const currency = body.currency === '' || body.currency == null ? null : typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : undefined;
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 99999999.99 || Math.abs(Math.round(price * 100) - price * 100) > 1e-6)) return { error: 'Price must be a non-negative amount with up to two decimal places.' };
  if (currency === undefined || (currency !== null && !/^[A-Z]{3}$/.test(currency))) return { error: 'Currency must be a three-letter code, such as USD.' };
  if (ingredientsText !== null && (typeof ingredientsText !== 'string' || ingredientsText.length > 5000)) return { error: 'Ingredient notes must be 5,000 characters or fewer.' };
  if (notes !== null && (typeof notes !== 'string' || notes.length > 5000)) return { error: 'Personal notes must be 5,000 characters or fewer.' };
  const ingredientIds = body.ingredientIds ?? [];
  if (!Array.isArray(ingredientIds) || ingredientIds.length > 100 || ingredientIds.some((id) => typeof id !== 'string' || !uuidPattern.test(id)) || new Set(ingredientIds).size !== ingredientIds.length) {
    return { error: 'Choose valid catalog ingredients.' };
  }
  const wouldRepurchase = body.wouldRepurchase ?? body.would_repurchase ?? null;
  if (wouldRepurchase !== null && typeof wouldRepurchase !== 'boolean') return { error: 'Choose whether you would buy this product again.' };
  return {
    value: {
      ...(userId ? { user_id: userId } : {}), name, brand: brand || null, category,
      image_path: imagePath, price, currency, ingredients_text: ingredientsText?.trim() || null,
      ...normalizedDates, pao_months: paoMonths, status, rating, notes: notes?.trim() || null,
      would_repurchase: wouldRepurchase,
    },
    ingredientIds,
  };
}

async function writeIngredientLinks(supabase, productId, ingredientIds) {
  const { data: current, error: currentError } = await supabase.from('product_ingredients')
    .select('ingredient_id').eq('product_id', productId);
  if (currentError) return currentError;
  const existingIds = new Set((current || []).map((row) => row.ingredient_id));
  const requestedIds = new Set(ingredientIds);
  const additions = ingredientIds.filter((id) => !existingIds.has(id));
  if (additions.length) {
    const { error } = await supabase.from('product_ingredients').insert(additions.map((ingredient_id) => ({ product_id: productId, ingredient_id, source: 'user' })));
    if (error) return error;
  }
  const removals = [...existingIds].filter((id) => !requestedIds.has(id));
  if (removals.length) {
    const { error } = await supabase.from('product_ingredients').delete().eq('product_id', productId).in('ingredient_id', removals);
    if (error) return error;
  }
  return null;
}

productRouter.get('/ingredients', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  let query = req.supabase.from('ingredients').select('id, name, slug').order('name').limit(30);
  if (search) query = query.ilike('name', `%${search.replace(/[%_]/g, '\\$&')}%`);
  const { data, error } = await query;
  if (error) return fail(res, error);
  return res.json({ ingredients: data || [] });
});

productRouter.get('/', async (req, res) => {
  const { data, error } = await req.supabase.from('products').select(productFields)
    .eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return fail(res, error);
  return res.json({ products: data || [] });
});

productRouter.post('/', async (req, res) => {
  const normalized = normalizeProduct(req.body, req.user.id);
  if (normalized.error) return res.status(400).json({ error: { code: 'INVALID_PRODUCT', message: normalized.error } });
  const { data, error } = await req.supabase.from('products').insert(normalized.value).select('id').single();
  if (error) return fail(res, error);
  const linkError = await writeIngredientLinks(req.supabase, data.id, normalized.ingredientIds);
  if (linkError) {
    console.error('Product ingredient links could not be saved', linkError);
    const rollback = await req.supabase.from('products').delete().eq('id', data.id);
    if (rollback.error) console.error('Product creation rollback failed', rollback.error);
    return res.status(500).json({ error: { code: 'PRODUCT_INGREDIENTS_FAILED', message: 'Catalog ingredients could not be attached. Please try saving the product again.' } });
  }
  const { data: product, error: fetchError } = await req.supabase.from('products').select(productFields).eq('id', data.id).eq('user_id', req.user.id).single();
  if (fetchError) return fail(res, fetchError);
  return res.status(201).json({ product });
});

productRouter.get('/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: { code: 'INVALID_PRODUCT_ID', message: 'That product link is not valid.' } });
  const { data, error } = await req.supabase.from('products').select(productFields)
    .eq('id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'We could not find that product in your library.' } });
  return res.json({ product: data });
});

productRouter.patch('/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: { code: 'INVALID_PRODUCT_ID', message: 'That product link is not valid.' } });
  const normalized = normalizeProduct(req.body, null);
  if (normalized.error) return res.status(400).json({ error: { code: 'INVALID_PRODUCT', message: normalized.error } });
  const { data, error } = await req.supabase.from('products').update(normalized.value)
    .eq('id', req.params.id).eq('user_id', req.user.id).select('id').maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'We could not find that product in your library.' } });
  const linkError = await writeIngredientLinks(req.supabase, data.id, normalized.ingredientIds);
  if (linkError) return fail(res, linkError);
  const result = await req.supabase.from('products').select(productFields).eq('id', data.id).eq('user_id', req.user.id).single();
  if (result.error) return fail(res, result.error);
  return res.json({ product: result.data });
});

productRouter.delete('/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: { code: 'INVALID_PRODUCT_ID', message: 'That product link is not valid.' } });
  const { data, error } = await req.supabase.from('products').delete()
    .eq('id', req.params.id).eq('user_id', req.user.id).select('id').maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'We could not find that product in your library.' } });
  return res.json({ deleted: true });
});
