import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import handler from '../../api/[...path].js';

async function startHandlerServer(t) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('root Vercel catch-all handler loads as ESM and serves the API health response', async (t) => {
  const baseUrl = await startHandlerServer(t);
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'Little Rituals API',
  });
});

test('root Vercel catch-all forwards nested routine routes to Express authentication', async (t) => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
  t.after(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  const baseUrl = await startHandlerServer(t);
  const routineId = 'cba53bde-1848-4bc7-a1ca-8d35f3d70c01';
  const stepId = '7da47ae5-2f96-4d64-a03c-82f824a51a01';
  const requests = [
    ['GET', `/api/routines?date=2026-10-22`],
    ['POST', `/api/routines/${routineId}/steps`],
    ['PATCH', `/api/routines/${routineId}/steps/${stepId}`],
    ['DELETE', `/api/routines/${routineId}/steps/${stepId}`],
    ['PUT', `/api/routines/${routineId}/steps/order`],
    // The UI stores ordered daily progress at routine level, not step level.
    ['PUT', `/api/routines/${routineId}/completion`],
  ];

  for (const [method, path] of requests) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
      ...(method === 'GET' ? {} : { body: '{}' }),
    });
    assert.equal(response.status, 401, `${method} ${path} should reach protected Express routing`);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.equal((await response.json()).error.code, 'UNAUTHORIZED');
  }
});
