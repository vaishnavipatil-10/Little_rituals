import { Router } from 'express';

export const profileRouter = Router();

function fail(res, error) {
  console.error('Profile data request failed', error);
  return res.status(500).json({ error: { code: 'PROFILE_REQUEST_FAILED', message: 'Your profile could not be saved. Please try again.' } });
}

profileRouter.get('/', async (req, res) => {
  const { data, error } = await req.supabase.from('profiles')
    .select('id, display_name, avatar_path, created_at, updated_at')
    .eq('id', req.user.id).maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Your profile is not ready yet. Please try again shortly.' } });
  return res.json({ profile: data });
});

profileRouter.patch('/', async (req, res) => {
  const { displayName } = req.body ?? {};
  if (typeof displayName !== 'string' || displayName.trim().length > 80) {
    return res.status(400).json({ error: { code: 'INVALID_PROFILE', message: 'Enter a display name with 80 characters or fewer.' } });
  }
  const { data, error } = await req.supabase.from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', req.user.id).select('id, display_name, avatar_path, created_at, updated_at').single();
  if (error) return fail(res, error);
  return res.json({ profile: data });
});

profileRouter.get('/skin', async (req, res) => {
  const { data, error } = await req.supabase.from('skin_profiles')
    .select('user_id, skin_type, concerns, avoid_ingredients, goals, updated_at')
    .eq('user_id', req.user.id).maybeSingle();
  if (error) return fail(res, error);
  if (!data) return res.status(404).json({ error: { code: 'SKIN_PROFILE_NOT_FOUND', message: 'Your skin profile is not ready yet. Please try again shortly.' } });
  return res.json({ skinProfile: data });
});

profileRouter.patch('/skin', async (req, res) => {
  const { concerns, avoidIngredients, goals } = req.body ?? {};
  const skinType = req.body?.skinType === '' ? null : req.body?.skinType;
  const allowedTypes = ['oily','dry','combination','sensitive','normal'];
  const arrayFields = [concerns, avoidIngredients, goals];
  if (skinType !== null && skinType !== undefined && !allowedTypes.includes(skinType)) {
    return res.status(400).json({ error: { code: 'INVALID_SKIN_TYPE', message: 'Choose a skin type from the available options.' } });
  }
  if (arrayFields.some((value) => value !== undefined && (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== 'string' || item.trim().length > 80)))) {
    return res.status(400).json({ error: { code: 'INVALID_SKIN_PROFILE', message: 'Check your selections and try again.' } });
  }
  const updates = { user_id: req.user.id };
  if (skinType !== undefined) updates.skin_type = skinType;
  if (concerns !== undefined) updates.concerns = concerns.map((item) => item.trim());
  if (avoidIngredients !== undefined) updates.avoid_ingredients = avoidIngredients.map((item) => item.trim());
  if (goals !== undefined) updates.goals = goals.map((item) => item.trim());
  const { data, error } = await req.supabase.from('skin_profiles')
    .upsert(updates).select('user_id, skin_type, concerns, avoid_ingredients, goals, updated_at').single();
  if (error) return fail(res, error);
  return res.json({ skinProfile: data });
});
