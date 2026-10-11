import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import { progressRouter } from '../src/routes/progress.js';
import { classifyExpiry } from '../../frontend/src/utils/expiry.js';
import { makeProgressReport } from '../../frontend/src/utils/progressReport.js';

const userId = '9f416936-0e3d-4117-8fac-564284cf76f1';
const otherUserId = '9f416936-0e3d-4117-8fac-564284cf76f2';
const productId = 'bd7cb641-8254-4dce-9178-23ea2f70f5a1';
const otherProductId = 'bd7cb641-8254-4dce-9178-23ea2f70f5a2';
const secondProductId = 'bd7cb641-8254-4dce-9178-23ea2f70f5a3';
const tables = {};
let server; let baseUrl;

function mockSupabase() {
  return { from(table) {
    const query = { filters: [], orders: [], limitCount: Infinity };
    query.select = () => query;
    query.eq = (field, value) => { query.filters.push((row) => row[field] === value); return query; };
    query.in = (field, values) => { query.filters.push((row) => values.includes(row[field])); return query; };
    query.gte = (field, value) => { query.filters.push((row) => row[field] >= value); return query; };
    query.lte = (field, value) => { query.filters.push((row) => row[field] <= value); return query; };
    query.lt = (field, value) => { query.filters.push((row) => row[field] < value); return query; };
    query.order = (field, options = {}) => { query.orders.push([field, options.ascending !== false]); return query; };
    query.limit = (value) => { query.limitCount = value; return query; };
    function execute() {
      let rows = (tables[table] || []).filter((row) => query.filters.every((filter) => filter(row)));
      for (const [field, ascending] of [...query.orders].reverse()) rows = rows.sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (ascending ? 1 : -1));
      return { data: rows.slice(0, query.limitCount), error: null };
    }
    query.maybeSingle = async () => ({ data: execute().data[0] || null, error: null });
    query.then = (resolve, reject) => Promise.resolve(execute()).then(resolve, reject);
    return query;
  } };
}

before(async () => {
  const app = express();
  app.use((req, _res, next) => { req.user = { id: userId }; req.supabase = mockSupabase(); next(); });
  app.use('/api/progress', progressRouter);
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/progress`;
});

after(async () => { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

beforeEach(() => {
  const today = new Date().toISOString().slice(0, 10);
  tables.products = [
    { id: productId, user_id: userId, name: 'My moisturizer', status: 'using', expiry_date: today },
    { id: otherProductId, user_id: otherUserId, name: 'Private product', status: 'using' },
  ];
  tables.routines = [{ id: 'routine-own', user_id: userId, name: 'Morning', routine_type: 'morning' }, { id: 'routine-other', user_id: otherUserId, name: 'Other', routine_type: 'night' }];
  tables.routine_completions = [{ user_id: userId, routine_id: 'routine-own', completed_on: today, completed_steps: 2, total_steps: 3 }, { user_id: otherUserId, routine_id: 'routine-other', completed_on: today, completed_steps: 3, total_steps: 3 }];
  tables.journal_entries = [{ user_id: userId, entry_date: today, skin_rating: 4, mood: 'calm', sleep_hours: 8 }, { user_id: otherUserId, entry_date: today, skin_rating: 1 }];
  tables.water_entries = [{ user_id: userId, logged_at: `${today}T12:00:00.000Z`, amount_ml: 500 }, { user_id: otherUserId, logged_at: `${today}T12:00:00.000Z`, amount_ml: 900 }];
  tables.user_settings = [{ user_id: userId, water_goal_ml: 1800 }];
  tables.product_ingredients = [{ product_id: productId, ingredients: { id: 'ingredient-1', slug: 'retinol', name: 'Retinol', tags: ['retinoid'], interactions: ['Pairing note from catalog.'], cautions: ['Use cautiously.'], guidance: 'Follow the label.', reviewed_at: today } }];
  tables.skin_profiles = [{ user_id: userId, avoid_ingredients: ['retinol'] }];
});

test('progress summary returns owned records only for charts and expiry watch', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.products.map((item) => item.name), ['My moisturizer']);
  assert.equal(body.routines.length, 1);
  assert.equal(body.completions.length, 1);
  assert.equal(body.journal.length, 1);
  assert.equal(body.water.length, 1);
  assert.equal(body.waterGoalMl, 1800);
  assert.equal(body.water[0].entry_date, body.today);
});

test('progress validates local calendar dates and time-zone offsets', async () => {
  const badDate = await fetch(`${baseUrl}?today=2026-02-30&timezoneOffsetMinutes=0`);
  assert.equal(badDate.status, 400);
  const badOffset = await fetch(`${baseUrl}?today=2026-10-11&timezoneOffsetMinutes=900`);
  assert.equal(badOffset.status, 400);
});

test('progress groups UTC water timestamps into the selected local calendar date', async () => {
  tables.water_entries = [{ user_id: userId, logged_at: '2026-10-10T20:00:00.000Z', amount_ml: 420 }];
  const response = await fetch(`${baseUrl}?today=2026-10-11&timezoneOffsetMinutes=-330`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.water[0].entry_date, '2026-10-11');
});

test('compatibility notes return linked catalog guidance and profile matches for owned products only', async () => {
  const response = await fetch(`${baseUrl}/compatibility?productIds=${productId}`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.products[0].name, 'My moisturizer');
  assert.equal(body.products[0].ingredients[0].interactions[0], 'Pairing note from catalog.');
  assert.equal(body.avoidMatches[0].name, 'Retinol');
  const privateResponse = await fetch(`${baseUrl}/compatibility?productIds=${otherProductId}`);
  assert.equal(privateResponse.status, 404);
});

test('compatibility responds with no invented ingredient findings when a product has no linked catalog records', async () => {
  tables.product_ingredients = [];
  const response = await fetch(`${baseUrl}/compatibility?productIds=${productId}`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.products[0].ingredients, []);
  assert.deepEqual(body.avoidMatches, []);
});

test('compatibility flags only the supported retinoid and exfoliant combination across selected products', async () => {
  tables.products.push({ id: secondProductId, user_id: userId, name: 'Salicylic serum' });
  tables.product_ingredients.push({ product_id: secondProductId, ingredients: { id: 'ingredient-2', slug: 'salicylic-acid', name: 'Salicylic acid', tags: ['exfoliant'], interactions: [], cautions: ['May irritate.'], reviewed_at: new Date().toISOString().slice(0, 10) } });
  const response = await fetch(`${baseUrl}/compatibility?productIds=${productId},${secondProductId}`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.warnings.length, 1);
  assert.equal(body.warnings[0].code, 'POTENTIAL_IRRITATION');
  assert.equal(body.products.length, 2);
});

test('expiry classification separates expired, soon, unknown, and later dates with a 30-day window', () => {
  assert.equal(classifyExpiry({ expiry_date: '2026-10-10', status: 'using' }, '2026-10-11'), 'expired');
  assert.equal(classifyExpiry({ expiry_date: '2026-11-10', status: 'using' }, '2026-10-11'), 'soon');
  assert.equal(classifyExpiry({ expiry_date: null, status: 'using' }, '2026-10-11'), 'unknown');
  assert.equal(classifyExpiry({ expiry_date: '2026-12-01', status: 'using' }, '2026-10-11'), 'later');
  assert.equal(classifyExpiry({ expiry_date: null, status: 'expired' }, '2026-10-11'), 'expired');
});

test('weekly report uses saved totals and leaves unrecorded days blank', () => {
  const report = makeProgressReport({
    today: '2026-10-11',
    water: [{ entry_date: '2026-10-11', amount_ml: 420 }],
    journal: [{ entry_date: '2026-10-11', skin_rating: 4 }, { entry_date: '2026-10-08', skin_rating: 2 }],
    completions: [{ completed_on: '2026-10-11', completed_steps: 2, total_steps: 4 }, { completed_on: '2026-10-10', completed_steps: 1, total_steps: 2 }],
  });
  assert.equal(report.days[6].date, '2026-10-11');
  assert.equal(report.days[6].water, 420);
  assert.equal(report.days[5].water, null);
  assert.equal(report.days[6].skin, 4);
  assert.equal(report.days[6].routinePct, 50);
  assert.equal(report.routinePct, 50);
  assert.equal(report.totalWater, 420);
  assert.equal(report.waterDays, 1);
  assert.equal(report.weeklyJournal, 2);
});
