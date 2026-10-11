import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import { ingredientRouter } from '../src/routes/ingredients.js';
import { productRouter } from '../src/routes/products.js';

const userId = '9f416936-0e3d-4117-8fac-564284cf76f1';
const otherUserId = '9f416936-0e3d-4117-8fac-564284cf76f2';
const ingredientId = 'df6fda7f-4825-4d16-aea4-2c84c956ce4c';
const ingredientRecord = { id: ingredientId, slug: 'glycerin', name: 'Glycerin', summary: 'A humectant used to attract and retain moisture.', uses: ['humectant'], benefits: ['supports hydration'], cautions: ['may feel tacky at high concentrations'], suitable_skin_types: ['dry', 'normal'], caution_skin_types: ['sensitive'], tags: ['humectant', 'hydration'], guidance: 'Use as directed on the finished product.', interactions: [], reviewed_at: '2025-01-15' };
const ingredientCatalog = [structuredClone(ingredientRecord)];
let products = [];
let links = [];
let server;
let baseUrl;

function mockSupabase() {
  return { from(table) {
    const query = { table, operation: 'select', filters: [], values: null, max: Infinity };
    query.select = (fields = '*') => { query.fields = fields; if (query.operation === 'select') query.operation = 'select'; return query; };
    query.insert = (values) => { query.operation = 'insert'; query.values = values; return query; };
    query.update = (values) => { query.operation = 'update'; query.values = values; return query; };
    query.delete = () => { query.operation = 'delete'; return query; };
    query.eq = (field, value) => { query.filters.push((row) => row[field] === value); return query; };
    query.in = (field, values) => { query.filters.push((row) => values.includes(row[field])); return query; };
    query.ilike = (field, pattern) => { const term = pattern.replace(/^%|%$/g, '').replaceAll('\\%', '%').toLowerCase(); query.filters.push((row) => String(row[field] || '').toLowerCase().includes(term)); return query; };
    query.order = () => query;
    query.limit = (value) => { query.max = value; return query; };
    function project(row) {
      if (table !== 'products') return row;
      const columns = (query.fields || '*').split(',').map((field) => field.trim().split('(')[0]).filter((field) => field !== '*' && field !== 'product_ingredients');
      const projected = columns.length ? Object.fromEntries(columns.filter((field) => Object.hasOwn(row, field)).map((field) => [field, row[field]])) : { ...row };
      if (query.fields?.includes('product_ingredients')) projected.product_ingredients = links.filter((link) => link.product_id === row.id).map((link) => ({ ingredient_id: link.ingredient_id, ingredients: ingredientCatalog.find((item) => item.id === link.ingredient_id) || null }));
      return projected;
    }
    function execute() {
      const rows = table === 'products' ? products : table === 'product_ingredients' ? links : ingredientCatalog;
      if (query.operation === 'insert') {
        const inserted = (Array.isArray(query.values) ? query.values : [query.values]).map((value) => {
          const row = table === 'products' ? { id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...value } : value;
          rows.push(row); return row;
        });
        return { data: inserted, error: null };
      }
      const matched = rows.filter((row) => query.filters.every((filter) => filter(row)));
      if (query.operation === 'update') { matched.forEach((row) => Object.assign(row, query.values, { updated_at: new Date().toISOString() })); return { data: matched.map(project), error: null }; }
      if (query.operation === 'delete') {
        const remove = new Set(matched);
        if (table === 'products') { products = products.filter((row) => !remove.has(row)); const ids = new Set([...remove].map((row) => row.id)); links = links.filter((link) => !ids.has(link.product_id)); }
        else if (table === 'product_ingredients') links = links.filter((row) => !remove.has(row));
        return { data: matched, error: null };
      }
      return { data: matched.slice(0, query.max).map(project), error: null };
    }
    query.single = async () => { const result = execute(); return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error }; };
    query.maybeSingle = query.single;
    query.then = (resolve, reject) => Promise.resolve(execute()).then(resolve, reject);
    return query;
  } };
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId }; req.supabase = mockSupabase(); next(); });
  app.use('/api/products', productRouter);
  app.use('/api/ingredients', ingredientRouter);
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/products`;
});

beforeEach(() => { products = []; links = []; ingredientCatalog.splice(0, ingredientCatalog.length, structuredClone(ingredientRecord)); });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });

test('product create, list, edit and delete use only schema-backed fields', async () => {
  const createdResponse = await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    name: 'Soft cleanser', brand: 'Little Botanics', category: 'cleanser', imageUrl: 'https://example.test/cleanser.png', ingredientsText: 'Glycerin, oat', price: 21.99, currency: 'USD',
    purchaseDate: '2026-02-02', openedDate: '2026-02-04', expiryDate: '2027-02-04', paoMonths: 12, status: 'using', rating: 4, notes: 'Gentle on my skin.', wouldRepurchase: true, ingredientIds: [ingredientId],
  }) });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).product;
  assert.equal(created.user_id, userId);
  assert.equal(created.name, 'Soft cleanser');
  assert.equal(created.price, 21.99);
  assert.equal(created.currency, 'USD');
  assert.equal(created.product_ingredients[0].ingredients.name, 'Glycerin');

  const otherProductId = '1b443559-e229-43ea-84fc-013eba02ac71';
  products.push({ ...created, id: otherProductId, user_id: otherUserId });
  const listResponse = await fetch(baseUrl);
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).products.length, 1);

  const editedResponse = await fetch(`${baseUrl}/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    name: 'Soft daily cleanser', brand: 'Little Botanics', category: 'cleanser', imageUrl: '', ingredientsText: 'Oat', purchaseDate: '', openedDate: '', expiryDate: '', paoMonths: '', status: 'finished', rating: 5, notes: '', wouldRepurchase: false, ingredientIds: [],
  }) });
  assert.equal(editedResponse.status, 200);
  const edited = (await editedResponse.json()).product;
  assert.equal(edited.name, 'Soft daily cleanser');
  assert.equal(edited.status, 'finished');
  assert.equal(edited.product_ingredients.length, 0);

  const otherUserResponse = await fetch(`${baseUrl}/${otherProductId}`);
  assert.equal(otherUserResponse.status, 404);
  const otherEditResponse = await fetch(`${baseUrl}/${otherProductId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Changed by someone else' }) });
  assert.equal(otherEditResponse.status, 404);
  const otherDeleteResponse = await fetch(`${baseUrl}/${otherProductId}`, { method: 'DELETE' });
  assert.equal(otherDeleteResponse.status, 404);

  const deletedResponse = await fetch(`${baseUrl}/${created.id}`, { method: 'DELETE' });
  assert.equal(deletedResponse.status, 200);
  assert.equal((await deletedResponse.json()).deleted, true);
  assert.equal(products.length, 1);
  assert.equal(products[0].user_id, otherUserId);
  assert.equal(links.length, 0);
});

test('invalid schema enum values and invalid dates are rejected before writes', async () => {
  const invalidStatus = await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Wishlisted item', category: 'serum', status: 'wishlist' }) });
  assert.equal(invalidStatus.status, 400);
  assert.equal((await invalidStatus.json()).error.code, 'INVALID_PRODUCT');
  const invalidDate = await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Serum', category: 'serum', purchaseDate: '2026-02-30' }) });
  assert.equal(invalidDate.status, 400);
  const invalidPrice = await fetch(baseUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Serum', category: 'serum', price: -1 }) });
  assert.equal(invalidPrice.status, 400);
  assert.equal(products.length, 0);
});

test('ingredient search covers benefits, filters use actual tags and skin types, and detail lists only the signed-in user products', async () => {
  const benefitSearch = await fetch(`${baseUrl.replace('/products', '/ingredients')}?search=hydration`);
  assert.equal(benefitSearch.status, 200);
  assert.equal((await benefitSearch.json()).ingredients[0].name, 'Glycerin');

  const skinFilter = await fetch(`${baseUrl.replace('/products', '/ingredients')}?skinType=sensitive`);
  assert.equal((await skinFilter.json()).ingredients.length, 1);
  const tagFilter = await fetch(`${baseUrl.replace('/products', '/ingredients')}?tag=hydration`);
  assert.equal((await tagFilter.json()).ingredients.length, 1);

  const ownProductId = 'c427ea3e-951d-49fd-b866-7d6408fcb24c';
  const otherProductId = '2b3af5d2-6bd3-471b-b60b-8b5cf5e12cc1';
  products.push({ id: ownProductId, user_id: userId, name: 'My moisturizer', brand: 'My brand', category: 'moisturizer', status: 'using', notes: 'private note' });
  products.push({ id: otherProductId, user_id: otherUserId, name: 'Someone else’s moisturizer', brand: 'Other brand', category: 'moisturizer', status: 'using', notes: 'private note' });
  links.push({ product_id: ownProductId, ingredient_id: ingredientId, source: 'user' }, { product_id: otherProductId, ingredient_id: ingredientId, source: 'user' });
  const detail = await fetch(`${baseUrl.replace('/products', '/ingredients')}/${ingredientId}`);
  assert.equal(detail.status, 200);
  const result = await detail.json();
  assert.equal(result.ingredient.benefits[0], 'supports hydration');
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].id, ownProductId);
  assert.equal(Object.hasOwn(result.products[0], 'notes'), false);
});

test('ingredient detail returns a not-found response for an uncatalogued id', async () => {
  const response = await fetch(`${baseUrl.replace('/products', '/ingredients')}/3fd77623-58c6-423a-ae8f-6b55f79515bc`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'INGREDIENT_NOT_FOUND');
});
