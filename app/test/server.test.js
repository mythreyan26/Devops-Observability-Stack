const test = require('node:test');
const assert = require('node:assert');

// Configure test environment before loading application
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Ephemeral port
process.env.LOKI_URL = process.env.LOKI_URL || 'http://127.0.0.1:3100';
process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://127.0.0.1:4318/v1/traces';

const sdk = require('../tracing');
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
    // 1. Terminate all open keep-alive connections and close HTTP server
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }

    // 2. Close logger and Loki transport handles
    if (typeof app.closeApp === 'function') {
      await app.closeApp();
    }

    // 3. Gracefully shutdown OpenTelemetry SDK
    if (sdk && typeof sdk.shutdown === 'function') {
      await sdk.shutdown().catch(() => {});
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
