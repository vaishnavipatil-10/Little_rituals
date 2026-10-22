import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import handler from '../../api/[...path].js';

test('root Vercel catch-all handler loads as ESM and serves the API health response', async (t) => {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'Little Rituals API',
  });
});
