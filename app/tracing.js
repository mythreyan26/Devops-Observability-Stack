// ==========================================
// OpenTelemetry Distributed Tracing Setup
// ==========================================
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

const serviceName = process.env.OTEL_SERVICE_NAME || 'nodejs-demo-app';
const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://jaeger:4318/v1/traces';

// Ensure OpenTelemetry environment detects the service name
process.env.OTEL_SERVICE_NAME = serviceName;

// Configure the OTLP HTTP trace exporter to push spans to Jaeger
const traceExporter = new OTLPTraceExporter({
  url: tracesEndpoint,
  timeoutMillis: process.env.NODE_ENV === 'test' ? 500 : 10000,
});

// Initialize the OpenTelemetry Node SDK
const sdk = new NodeSDK({
  serviceName: serviceName,
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable noisy internal filesystem spans to keep Jaeger traces clean and readable
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

// Start tracing
sdk.start();
if (process.env.NODE_ENV !== 'test') {
  console.log(`[OpenTelemetry] Distributed tracing started for service '${serviceName}' exporting to '${tracesEndpoint}'`);
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[OpenTelemetry] Tracing terminated cleanly'))
    .catch((error) => console.error('[OpenTelemetry] Error shutting down tracing', error))
    .finally(() => process.exit(0));
});

module.exports = sdk;
