import { Router } from 'express';

export const ingredientRouter = Router();

const ingredientFields = 'id, slug, name, summary, uses, benefits, cautions, suitable_skin_types, caution_skin_types, tags, guidance, interactions, reviewed_at';
const ingredientIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(res, error) {
  console.error('Ingredient request failed', error);
  return res.status(500).json({ error: { code: 'INGREDIENT_REQUEST_FAILED', message: 'Ingredient information could not be loaded. Please try again.' } });
}

function matchesSearch(ingredient, term) {
  const values = [ingredient.name, ingredient.summary, ingredient.guidance, ...(ingredient.uses || []), ...(ingredient.benefits || []), ...(ingredient.cautions || []), ...(ingredient.suitable_skin_types || []), ...(ingredient.caution_skin_types || []), ...(ingredient.tags || []), ...(ingredient.interactions || [])];
  return values.some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(term));
}

ingredientRouter.get('/', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100).toLocaleLowerCase() : '';
  const skinType = typeof req.query.skinType === 'string' ? req.query.skinType.trim().toLocaleLowerCase() : '';
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().toLocaleLowerCase() : '';
  const { data, error } = await req.supabase.from('ingredients').select(ingredientFields).order('name').limit(1000);
  if (error) return fail(res, error);
  const ingredients = (data || []).filter((ingredient) => {
    const skinTypes = [...(ingredient.suitable_skin_types || []), ...(ingredient.caution_skin_types || [])].map((value) => value.toLocaleLowerCase());
    const tags = (ingredient.tags || []).map((value) => value.toLocaleLowerCase());
    return (!search || matchesSearch(ingredient, search)) && (!skinType || skinTypes.includes(skinType)) && (!tag || tags.includes(tag));
  });
  return res.json({ ingredients });
});

ingredientRouter.get('/:id', async (req, res) => {
  if (!ingredientIdPattern.test(req.params.id)) return res.status(400).json({ error: { code: 'INVALID_INGREDIENT_ID', message: 'That ingredient link is not valid.' } });
  const { data: ingredient, error } = await req.supabase.from('ingredients').select(ingredientFields).eq('id', req.params.id).maybeSingle();
  if (error) return fail(res, error);
  if (!ingredient) return res.status(404).json({ error: { code: 'INGREDIENT_NOT_FOUND', message: 'We could not find that ingredient in the catalog.' } });

  const { data: links, error: linkError } = await req.supabase.from('product_ingredients').select('product_id').eq('ingredient_id', ingredient.id);
  if (linkError) return fail(res, linkError);
  const productIds = [...new Set((links || []).map((link) => link.product_id))];
  if (!productIds.length) return res.json({ ingredient, products: [] });

  // RLS already scopes the join table; the explicit owner filter is a second boundary.
  const { data: products, error: productError } = await req.supabase.from('products')
    .select('id, name, brand, category, status, image_path')
    .eq('user_id', req.user.id).in('id', productIds).order('name');
  if (productError) return fail(res, productError);
  return res.json({ ingredient, products: products || [] });
});
