// Initialize OpenTelemetry Tracing BEFORE requiring express, http or other packages
require('./tracing');

const express = require('express');
const client = require('prom-client');
const winston = require('winston');
const LokiTransport = require('winston-loki');
const { trace, context } = require('@opentelemetry/api');

const app = express();
const PORT = process.env.PORT || 3000;
const LOKI_URL = process.env.LOKI_URL || 'http://loki:3100';

// ==========================================
// 1. Winston Logger Setup (Console + Loki)
// ==========================================
// Configures winston to format every log line as a structured JSON object.
// We output to Console (stdout) and directly ship to Loki (centralized logging).
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // 1. Console transport for container stdout
    new winston.transports.Console(),

    // 2. Loki transport for centralized log aggregation
    new LokiTransport({
      host: LOKI_URL,
      labels: { app: 'nodejs-demo-app' },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => {
        console.error('Loki transport connection warning:', err.message);
      }
    })
  ]
});

// ==========================================
// 2. Prometheus Metrics Setup (prom-client)
// ==========================================
// Collect default Node.js and system metrics (e.g., CPU, memory heap, event loop lag)
client.collectDefaultMetrics({ prefix: 'nodejs_' });

// Counter Metric: Tracks the cumulative count of HTTP requests handled.
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status']
});

// Histogram Metric: Measures the distribution of request latencies in seconds.
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 1.5, 2, 2.5, 3, 5]
});

// ==========================================
// 3. Request Monitoring & Logging Middleware
// ==========================================
app.use((req, res, next) => {
  const startHrTime = process.hrtime();

  // Capture active OpenTelemetry span context for trace-to-log correlation
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan ? activeSpan.spanContext() : null;
  const traceId = spanContext ? spanContext.traceId : null;
  const spanId = spanContext ? spanContext.spanId : null;

  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const durationInSeconds = elapsedHrTime[0] + elapsedHrTime[1] / 1e9;
    const durationInMs = Math.round(durationInSeconds * 1000);

    const route = req.route ? (req.baseUrl + req.route.path) : req.path;
    const status = res.statusCode.toString();

    // 1. Update Prometheus Counter
    httpRequestsTotal.inc({
      method: req.method,
      route: route,
      status: status
    });

    // 2. Update Prometheus Histogram
    httpRequestDurationSeconds.observe({
      method: req.method,
      route: route,
      status: status
    }, durationInSeconds);

    // 3. Output Structured JSON Log (with correlated trace_id and span_id)
    const logData = {
      method: req.method,
      route: route,
      status: res.statusCode,
      duration: `${durationInMs}ms`,
      duration_seconds: Number(durationInSeconds.toFixed(4))
    };

    if (traceId) {
      logData.trace_id = traceId;
      logData.span_id = spanId;
    }

    logger.info('HTTP request completed', logData);
  });

  next();
});

// ==========================================
// 4. Application Routes
// ==========================================

// Route: GET /
app.get('/', (req, res) => {
  res.status(200).send('Hello from observability demo');
});

// Route: GET /slow
app.get('/slow', async (req, res) => {
  const delayMs = Math.floor(Math.random() * 2000) + 1000;
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  res.status(200).send(`Slow response finished after ${delayMs}ms`);
});

// Route: GET /error
app.get('/error', (req, res) => {
  const isError = Math.random() < 0.5;
  if (isError) {
    res.status(500).send('Internal Server Error: Something went wrong!');
  } else {
    res.status(200).send('Success: Request processed without error.');
  }
});

// Route: GET /metrics
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ==========================================
// 5. Start Server
// ==========================================
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Observability demo app running on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      loki_url: LOKI_URL
    });
  });
}

module.exports = app;
