import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../server.mjs';

test('production HTTP server serves assets and health, and refuses file escapes and writes', async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /Охота на/);
    const health = await fetch(base + '/health'); assert.deepEqual(await health.json(), { status: 'ok' });
    for (const url of ['/game.js','/round.js','/style.css','/assets/frog.png','/assets/beetle.png']) {
      const response = await fetch(base + url); assert.equal(response.status, 200, url); await response.arrayBuffer();
    }
    const head = await fetch(base + '/assets/frog.png', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/server.mjs')).status, 404);
    assert.equal((await fetch(base + '/%ZZ')).status, 400);
    const escaped = await new Promise(resolve => { http.get(base + '/..%5cserver.mjs', response => { response.resume(); resolve(response.statusCode); }); });
    assert.equal(escaped, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
