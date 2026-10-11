import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import { routineRouter } from '../src/routes/routines.js';
import { journalRouter } from '../src/routes/journal.js';
import { waterRouter } from '../src/routes/water.js';

const userId = '9f416936-0e3d-4117-8fac-564284cf76f1';
const otherUserId = '9f416936-0e3d-4117-8fac-564284cf76f2';
const ownedRoutineId = 'cba53bde-1848-4bc7-a1ca-8d35f3d70c01';
const otherRoutineId = 'cba53bde-1848-4bc7-a1ca-8d35f3d70c02';
const productId = 'bd7cb641-8254-4dce-9178-23ea2f70f5a1';
const otherProductId = 'bd7cb641-8254-4dce-9178-23ea2f70f5a2';
const ownedEntryId = '7da47ae5-2f96-4d64-a03c-82f824a51a01';
const otherEntryId = '7da47ae5-2f96-4d64-a03c-82f824a51a02';
const ownedWaterId = 'dcf73d2d-7ed1-4428-88ab-6b1ce8b87e01';
const otherWaterId = 'dcf73d2d-7ed1-4428-88ab-6b1ce8b87e02';
const tables = {};
let server;
let baseUrl;

function fail(code, message) { return { data: null, error: { code, message } }; }

function mockSupabase() {
  return { from(table) {
    const query = { table, operation: 'select', filters: [], orders: [], limitCount: Infinity, values: null, conflict: '' };
    query.select = () => query;
    query.insert = (values) => { query.operation = 'insert'; query.values = values; return query; };
    query.update = (values) => { query.operation = 'update'; query.values = values; return query; };
    query.delete = () => { query.operation = 'delete'; return query; };
    query.upsert = (values, options = {}) => { query.operation = 'upsert'; query.values = values; query.conflict = options.onConflict || ''; return query; };
    query.eq = (field, value) => { query.filters.push((row) => row[field] === value); return query; };
    query.in = (field, values) => { query.filters.push((row) => values.includes(row[field])); return query; };
    query.gte = (field, value) => { query.filters.push((row) => row[field] >= value); return query; };
    query.lte = (field, value) => { query.filters.push((row) => row[field] <= value); return query; };
    query.lt = (field, value) => { query.filters.push((row) => row[field] < value); return query; };
    query.order = (field, options = {}) => { query.orders.push([field, options.ascending !== false]); return query; };
    query.limit = (value) => { query.limitCount = value; return query; };
    query.ilike = (field, pattern) => {
      const term = pattern.slice(1, -1).replaceAll('\\%', '%').replaceAll('\\_', '_').toLocaleLowerCase();
      query.filters.push((row) => String(row[field] || '').toLocaleLowerCase().includes(term)); return query;
    };
    function execute() {
      const rows = tables[table];
      if (!rows) return fail('42P01', `Unknown table ${table}`);
      let found = rows.filter((row) => query.filters.every((filter) => filter(row)));
      for (const [field, ascending] of [...query.orders].reverse()) found = found.sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (ascending ? 1 : -1));
      if (query.operation === 'insert') {
        const input = Array.isArray(query.values) ? query.values : [query.values];
        const created = input.map((value) => ({ id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...value }));
        if (table === 'journal_entries' && created.some((entry) => rows.some((row) => row.user_id === entry.user_id && row.entry_date === entry.entry_date))) return fail('23505', 'duplicate journal date');
        if (table === 'routine_steps' && created.some((step) => rows.some((row) => row.routine_id === step.routine_id && row.position === step.position))) return fail('23505', 'duplicate routine position');
        rows.push(...created); return { data: created, error: null };
      }
      if (query.operation === 'upsert') {
        const value = query.values;
        const conflictFields = query.conflict.split(',').filter(Boolean);
        const existing = rows.find((row) => conflictFields.length && conflictFields.every((field) => row[field] === value[field]));
        if (existing) Object.assign(existing, value, { completed_at: new Date().toISOString() });
        else rows.push({ id: randomUUID(), created_at: new Date().toISOString(), ...value });
        return { data: existing || rows.at(-1), error: null };
      }
      if (query.operation === 'update') {
        for (const row of found) {
          const changesPosition = table === 'routine_steps' && Object.hasOwn(query.values, 'position');
          if (changesPosition && rows.some((candidate) => candidate !== row && candidate.routine_id === row.routine_id && candidate.position === query.values.position)) return fail('23505', 'duplicate routine position');
        }
        found.forEach((row) => Object.assign(row, query.values, { updated_at: new Date().toISOString() }));
        return { data: found, error: null };
      }
      if (query.operation === 'delete') {
        const deleted = new Set(found); tables[table] = rows.filter((row) => !deleted.has(row)); return { data: found, error: null };
      }
      return { data: found.slice(0, query.limitCount), error: null };
    }
    query.single = async () => { const result = execute(); return { data: Array.isArray(result.data) ? result.data[0] || null : result.data, error: result.error }; };
    query.maybeSingle = query.single;
    query.then = (resolve, reject) => Promise.resolve(execute()).then(resolve, reject);
    return query;
  } };
}

before(async () => {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId }; req.supabase = mockSupabase(); next(); });
  app.use('/api/routines', routineRouter); app.use('/api/journal', journalRouter); app.use('/api/water', waterRouter);
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

beforeEach(() => {
  Object.assign(tables, {
    routines: [
      { id: ownedRoutineId, user_id: userId, name: 'My morning', routine_type: 'morning' },
      { id: otherRoutineId, user_id: otherUserId, name: 'Private evening', routine_type: 'night' },
    ],
    routine_steps: [], routine_completions: [],
    products: [
      { id: productId, user_id: userId, name: 'My moisturizer' },
      { id: otherProductId, user_id: otherUserId, name: 'Other user product' },
    ],
    journal_entries: [
      { id: ownedEntryId, user_id: userId, entry_date: '2026-10-10', notes: 'A calm skin day', skin_rating: 4, concerns: [], tags: [] },
      { id: otherEntryId, user_id: otherUserId, entry_date: '2026-10-10', notes: 'Private note', concerns: [], tags: [] },
    ],
    user_settings: [{ user_id: userId, water_goal_ml: 2000, volume_unit: 'ml' }],
    water_entries: [
      { id: ownedWaterId, user_id: userId, amount_ml: 250, logged_at: '2026-10-11T05:00:00.000Z' },
      { id: otherWaterId, user_id: otherUserId, amount_ml: 900, logged_at: '2026-10-11T05:10:00.000Z' },
    ],
  });
});

after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });

test('routines are owner scoped, accept only owned products, reorder steps, and save daily completion counts', async () => {
  const createdResponse = await fetch(`${baseUrl}/routines`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Evening care', routineType: 'night', userId: otherUserId }) });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).routine;
  assert.equal(created.user_id, userId);
  assert.equal(created.description, undefined);
  const editRoutine = await fetch(`${baseUrl}/routines/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Evening unwind' }) });
  assert.equal((await editRoutine.json()).routine.name, 'Evening unwind');

  const otherProduct = await fetch(`${baseUrl}/routines/${created.id}/steps`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stepType: 'Moisturize', productId: otherProductId }) });
  assert.equal(otherProduct.status, 404);
  const addStep = (stepType, position) => fetch(`${baseUrl}/routines/${created.id}/steps`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stepType, position, productId }) });
  const first = await addStep('Cleanse', 0); const firstStep = (await first.json()).step;
  const second = await addStep('Moisturize', 1); const secondStep = (await second.json()).step;
  assert.equal(first.status, 201); assert.equal(second.status, 201); assert.equal(firstStep.product_id, productId);
  const editStep = await fetch(`${baseUrl}/routines/${created.id}/steps/${firstStep.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stepType: 'Gentle cleanse', notes: 'Use a small amount' }) });
  assert.equal((await editStep.json()).step.step_type, 'Gentle cleanse');

  const reorder = await fetch(`${baseUrl}/routines/${created.id}/steps/order`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stepIds: [secondStep.id, firstStep.id] }) });
  assert.equal(reorder.status, 200);
  assert.deepEqual((await reorder.json()).steps.map((step) => step.id), [secondStep.id, firstStep.id]);
  const progress = await fetch(`${baseUrl}/routines/${created.id}/completion`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: '2026-10-11', completedSteps: 1 }) });
  assert.equal(progress.status, 200); assert.equal((await progress.json()).completion.total_steps, 2);
  const list = await fetch(`${baseUrl}/routines?date=2026-10-11`); const listBody = await list.json();
  assert.equal(listBody.routines.some((routine) => routine.id === otherRoutineId), false);
  assert.equal(listBody.routines.find((routine) => routine.id === created.id).completion.completed_steps, 1);
  const removeStep = await fetch(`${baseUrl}/routines/${created.id}/steps/${firstStep.id}`, { method: 'DELETE' });
  assert.equal(removeStep.status, 200);
  const privateRoutine = await fetch(`${baseUrl}/routines/${otherRoutineId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Changed' }) });
  assert.equal(privateRoutine.status, 404);
});

test('journal supports create, search, edit, delete, duplicate-date protection, and owner scoping', async () => {
  const createdResponse = await fetch(`${baseUrl}/journal`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entryDate: '2026-10-11', skinRating: 5, skinCondition: 'Calm', mood: 'Rested', sleepHours: 7.5, notes: 'A peaceful evening', concerns: ['dryness'], tags: ['night'] }) });
  assert.equal(createdResponse.status, 201); const created = (await createdResponse.json()).entry; assert.equal(created.user_id, userId);
  const duplicate = await fetch(`${baseUrl}/journal`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entryDate: '2026-10-11' }) });
  assert.equal(duplicate.status, 409);
  const search = await fetch(`${baseUrl}/journal?search=peaceful&from=2026-10-11&to=2026-10-11`);
  assert.equal((await search.json()).entries[0].id, created.id);
  const edit = await fetch(`${baseUrl}/journal/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: 'A gentle evening' }) });
  assert.equal((await edit.json()).entry.notes, 'A gentle evening');
  const crossUser = await fetch(`${baseUrl}/journal/${otherEntryId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: 'No access' }) });
  assert.equal(crossUser.status, 404);
  const remove = await fetch(`${baseUrl}/journal/${created.id}`, { method: 'DELETE' });
  assert.equal(remove.status, 200); assert.equal(tables.journal_entries.some((entry) => entry.id === created.id), false);
});

test('water tracker saves a personal goal, logs, totals, corrects, deletes, and scopes entries to their owner', async () => {
  const bounds = 'startAt=2026-10-11T00%3A00%3A00.000Z&endAt=2026-10-12T00%3A00%3A00.000Z';
  const initial = await fetch(`${baseUrl}/water?${bounds}`); const initialBody = await initial.json();
  assert.equal(initialBody.totalMl, 250); assert.equal(initialBody.entries.length, 1); assert.equal(initialBody.goalMl, 2000);
  const goal = await fetch(`${baseUrl}/water/goal`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goalMl: 1750 }) });
  assert.equal((await goal.json()).goalMl, 1750);
  const createdResponse = await fetch(`${baseUrl}/water`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountMl: 500, loggedAt: '2026-10-11T06:00:00.000Z', userId: otherUserId }) });
  assert.equal(createdResponse.status, 201); const created = (await createdResponse.json()).entry;
  assert.equal(tables.water_entries.find((entry) => entry.id === created.id).user_id, userId);
  const afterAdd = await fetch(`${baseUrl}/water?${bounds}`); assert.equal((await afterAdd.json()).totalMl, 750);
  const correction = await fetch(`${baseUrl}/water/${created.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountMl: 750 }) });
  assert.equal((await correction.json()).entry.amount_ml, 750);
  const other = await fetch(`${baseUrl}/water/${otherWaterId}`, { method: 'DELETE' }); assert.equal(other.status, 404);
  const deletion = await fetch(`${baseUrl}/water/${created.id}`, { method: 'DELETE' }); assert.equal(deletion.status, 200);
  const invalidAmount = await fetch(`${baseUrl}/water`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountMl: 0 }) }); assert.equal(invalidAmount.status, 400);
});
