import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { privacyRouter } from '../src/routes/privacy.js';

const owner = 'user-a';
const fixtures = {
  profiles: [{ id: owner, display_name: 'Ritual Keeper' }, { id: 'user-b', display_name: 'Other person' }],
  skin_profiles: [{ user_id: owner, skin_type: 'dry' }, { user_id: 'user-b', skin_type: 'oily' }],
  user_settings: [{ user_id: owner, theme: 'cream' }],
  products: [{ id: 'product-a', user_id: owner, name: 'My cream', notes: 'private note' }, { id: 'product-b', user_id: 'user-b', name: 'Other cream', notes: 'other note' }],
  routines: [{ id: 'routine-a', user_id: owner, name: 'Morning' }, { id: 'routine-b', user_id: 'user-b', name: 'Other routine' }],
  journal_entries: [{ user_id: owner, entry_date: '2026-01-01', note: 'my reflection' }, { user_id: 'user-b', entry_date: '2026-01-01', note: 'other reflection' }],
  water_entries: [{ user_id: owner, amount_ml: 200 }, { user_id: 'user-b', amount_ml: 500 }],
  product_ingredients: [{ product_id: 'product-a', ingredient_id: 'ingredient-a' }, { product_id: 'product-b', ingredient_id: 'ingredient-b' }],
  routine_steps: [{ routine_id: 'routine-a', label: 'Cleanse' }, { routine_id: 'routine-b', label: 'Other step' }],
  routine_completions: [{ user_id: owner, completed_on: '2026-01-01' }, { user_id: 'user-b', completed_on: '2026-01-01' }],
  ingredients: [{ id: 'ingredient-a', slug: 'glycerin', name: 'Glycerin' }, { id: 'ingredient-b', slug: 'retinol', name: 'Retinol' }],
};
let server; let baseUrl;
function mockSupabase() {
  return { from(table) {
    const query = { filters: [], start: 0, end: Infinity };
    query.select = () => query;
    query.eq = (field, value) => { query.filters.push((row) => row[field] === value); return query; };
    query.in = (field, values) => { query.filters.push((row) => values.includes(row[field])); return query; };
    query.order = () => query;
    query.range = (start, end) => { query.start = start; query.end = end; return query; };
    const execute = () => ({ data: (fixtures[table] || []).filter((row) => query.filters.every((filter) => filter(row))).slice(query.start, query.end + 1), error: null });
    query.maybeSingle = async () => ({ data: execute().data[0] || null, error: null });
    query.then = (resolve, reject) => Promise.resolve(execute()).then(resolve, reject);
    return query;
  } };
}
before(async () => {
  const app = express();
  app.use((req, _res, next) => { req.user = { id: owner, email: 'owner@example.test' }; req.supabase = mockSupabase(); next(); });
  app.use('/api/privacy', privacyRouter);
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/privacy/export`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });

test("privacy export includes the signed-in user's personal records and only their related rows", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.account.id, owner);
  assert.equal(data.profile.display_name, 'Ritual Keeper');
  assert.deepEqual(data.products.map((product) => product.id), ['product-a']);
  assert.deepEqual(data.routines.map((routine) => routine.id), ['routine-a']);
  assert.deepEqual(data.productIngredientLinks.map((link) => link.ingredient_id), ['ingredient-a']);
  assert.deepEqual(data.routineSteps.map((step) => step.label), ['Cleanse']);
  assert.deepEqual(data.ingredients.map((ingredient) => ingredient.name), ['Glycerin']);
  assert.deepEqual(data.journalEntries.map((entry) => entry.note), ['my reflection']);
  assert.equal(JSON.stringify(data).includes('other note'), false);
  assert.equal(JSON.stringify(data).includes('other reflection'), false);
});
