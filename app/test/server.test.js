const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// Load tracing mock/noop if needed before server
process.env.PORT = '0'; // Ephemeral port
process.env.NODE_ENV = 'test';
process.env.LOKI_URL = 'http://localhost:3100'; // mock URL for test

const app = require('../server');

test('Observability Application Suite', async (t) => {
  let server;
  let testUrl;

  t.before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        testUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  t.after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await t.test('GET / returns 200 and greeting text', async () => {
    const res = await fetch(`${testUrl}/`);
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    assert.strictEqual(body, 'Hello from observability demo');
  });

  await t.test('GET /metrics returns 200 and Prometheus text format', async () => {
    const res = await fetch(`${testUrl}/metrics`);
    assert.strictEqual(res.status, 200);
    const body = await res.text();
    assert.match(body, /http_requests_total/);
    assert.match(body, /http_request_duration_seconds/);
  });

  await t.test('GET /error returns either 200 or 500', async () => {
    const res = await fetch(`${testUrl}/error`);
    assert.ok(res.status === 200 || res.status === 500, `Expected 200 or 500, got ${res.status}`);
  });
});
