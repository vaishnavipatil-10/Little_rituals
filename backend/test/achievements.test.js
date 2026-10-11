import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import { achievementsRouter } from '../src/routes/achievements.js';

const userId = 'user-a';
const otherUser = 'user-b';
let completions; let journals; let server; let baseUrl;
function mockSupabase() {
  return { from(table) {
    const query = { filters: [], offset: 0, end: Infinity };
    query.select = () => query;
    query.eq = (field, value) => { query.filters.push((row) => row[field] === value); return query; };
    query.lte = (field, value) => { query.filters.push((row) => row[field] <= value); return query; };
    query.order = () => query;
    query.range = (start, end) => { query.offset = start; query.end = end; return query; };
    query.then = (resolve, reject) => Promise.resolve({ data: (table === 'routine_completions' ? completions : journals).filter((row) => query.filters.every((filter) => filter(row))).slice(query.offset, query.end + 1), error: null }).then(resolve, reject);
    return query;
  } };
}
before(async () => {
  const app = express();
  app.use((req, _res, next) => { req.user = { id: userId }; req.supabase = mockSupabase(); next(); });
  app.use('/api/achievements', achievementsRouter);
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/achievements`;
});
beforeEach(() => { completions = []; journals = []; });
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });

test('only consecutive, fully completed routine days unlock the seven-day certificate', async () => {
  const start = Date.UTC(2026, 0, 1);
  for (let day = 0; day < 7; day += 1) completions.push({ user_id: userId, completed_on: new Date(start + day * 86400000).toISOString().slice(0, 10), completed_steps: 3, total_steps: 3 });
  completions.push({ user_id: userId, completed_on: '2026-01-08', completed_steps: 2, total_steps: 3 });
  completions.push({ user_id: otherUser, completed_on: '2026-01-08', completed_steps: 3, total_steps: 3 });
  const response = await fetch(`${baseUrl}?today=2026-01-08`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.counts.completedRoutineDays, 7);
  assert.equal(data.certificates[0].eligible, true);
  assert.equal(data.certificates[0].startDate, '2026-01-01');
  assert.equal(data.certificates[0].endDate, '2026-01-07');
  assert.equal(data.badges.find((badge) => badge.id === 'routine-week').earned, true);
});

test('journal certificate remains locked until 30 consecutive signed-in-user dates exist', async () => {
  for (let day = 0; day < 29; day += 1) journals.push({ user_id: userId, entry_date: new Date(Date.UTC(2026, 1, 1 + day)).toISOString().slice(0, 10) });
  journals.push({ user_id: otherUser, entry_date: '2026-03-01' });
  let data = await (await fetch(`${baseUrl}?today=2026-03-01`)).json();
  assert.equal(data.certificates[1].eligible, false);
  journals.push({ user_id: userId, entry_date: '2026-01-31' });
  journals.push({ user_id: userId, entry_date: '2026-03-01' });
  data = await (await fetch(`${baseUrl}?today=2026-03-01`)).json();
  assert.equal(data.certificates[1].eligible, true);
  assert.equal(data.certificates[1].startDate, '2026-01-31');
  assert.equal(data.certificates[1].endDate, '2026-03-01');
  assert.equal(data.badges.filter((badge) => badge.earned).length, 2);
});

test('invalid achievement date is rejected', async () => {
  const response = await fetch(`${baseUrl}?today=2026-02-30`);
  assert.equal(response.status, 400);
});
