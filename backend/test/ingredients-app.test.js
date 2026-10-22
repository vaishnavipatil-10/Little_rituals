import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  process.env.SUPABASE_URL ||= 'https://project.test';
  process.env.SUPABASE_PUBLISHABLE_KEY ||= 'test-publishable-key';
  server = await new Promise((resolve) => {
    const listener = createApp().listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test('private API routes are mounted and return a clear response when authentication is missing', async () => {
  for (const path of ['/api/ingredients', '/api/routines', '/api/journal', '/api/water', '/api/progress', '/api/privacy/export', '/api/achievements']) {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.json();
    assert.equal(response.status, 401, `${path} should require authentication`);
    assert.equal(body.error.code, 'UNAUTHORIZED');
    assert.equal(body.error.message, 'Please sign in to continue.');
  }
});

test('unknown API paths return an API error instead of a page-not-found message', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-real-endpoint`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'NOT_FOUND');
  assert.equal(body.error.message, 'This API endpoint could not be found.');
});
