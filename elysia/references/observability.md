# Observability

Use built-in tracing for lifecycle timings, `@elysia/opentelemetry` for exported spans, and `@elysia/server-timing` for browser timing headers. Plugin versions and peer requirements are in [versions.md](versions.md).

Contents: [trace](#trace), [OpenTelemetry](#opentelemetry), [instrumentation](#instrumentation-and-bundling), [Server Timing](#server-timing).

## Trace

Enable `trace()` from `elysia/trace`, then register listeners with `.trace()`.

```ts
import { Elysia } from 'elysia'
import { trace } from 'elysia/trace'

export const app = new Elysia()
	.use(trace())
	.trace(({ id, onHandle }) => {
		onHandle(({ onStop }) => {
			onStop(({ elapsed, error }) => {
				console.log({ id, elapsed, error })
			})
		})
	})
	.get('/', () => 'Hello')
```

Register listeners synchronously. The v2 trace implementation does not await promises returned by trace callbacks. For headers that must reach the current response, mutate `set.headers` synchronously inside an `onStop` callback before response mapping. An `async onStop` callback is not a lifecycle barrier.

The trace callback receives `id`, `context`, `set`, `store`, `time`, and lifecycle listeners. `time` is the request timestamp; use `elapsed` or `end - begin` for durations.

| Listener | Work measured |
| --- | --- |
| `onRequest` | Request hooks |
| `onParse` | Body parsers |
| `onTransform` | Transforms before validation |
| `onBeforeHandle` | Hooks before the handler |
| `onHandle` | The handler |
| `onAfterHandle` | Hooks after the handler |
| `onMapResponse` | Response mapping |
| `onError` | Error hooks |
| `onAfterResponse` | Work after the response |

Each listener receives `id`, `event`, `name`, `begin`, `end: Promise<number>`, `error: Promise<Error | null>`, and `onStop`. The stop callback receives numeric `end`, `elapsed`, and `error`. Hook groups also expose `total` and `onEvent` to measure individual hooks:

```ts
new Elysia()
	.use(trace())
	.trace(({ onBeforeHandle }) => {
		onBeforeHandle(({ onEvent }) => {
			onEvent(({ name, onStop }) => {
				onStop(({ elapsed }) => console.log(name, elapsed))
			})
		})
	})
```

See [lifecycle](lifecycle.md) for execution order and early returns.

## OpenTelemetry

Register the plugin once. Match exporter configuration to the installed OpenTelemetry SDK.

```ts
import { Elysia } from 'elysia'
import { opentelemetry, record } from '@elysia/opentelemetry'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'

export const app = new Elysia()
	.use(opentelemetry({
		serviceName: 'example-api',
		spanProcessors: [
			new BatchSpanProcessor(new OTLPTraceExporter())
		]
	}))
	.get('/message', () => record('format-message', () => ({ text: 'Hello' })))
```

The exporter uses its configured endpoint and credentials. The plugin creates lifecycle spans and propagates request context to compatible instrumented libraries. Name hook functions for recognizable spans.

| Export | Purpose |
| --- | --- |
| `record(name, fn)` | Run a function in an active span, close it, and capture exceptions |
| `getCurrentSpan()` | Current active span, or `undefined` |
| `setAttributes(attributes)` | Add attributes to the active span when present |
| `getTracer()` | Access the tracer for lower-level span operations |

Options extend the OpenTelemetry Node SDK, including `serviceName`, `resource`, `sampler`, `instrumentations`, `spanProcessors`, and `traceExporter`. Avoid copying SDK option tables across SDK versions.

Elysia-specific options include `checkIfShouldTrace(request)`, `spanUrlRedaction`, `recordBody`, and `headersToSpanAttributes`. Body recording is off and header lists are empty by default. URL redaction is on by default. Enable capture only for the data needed by the task; all-header capture includes credentials and cookies.

## Instrumentation and bundling

Some instrumentation must precede the target module's load. For PostgreSQL, preload instrumentation before importing `pg`:

```ts
// src/instrumentation.ts
import { opentelemetry } from '@elysia/opentelemetry'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'

export const instrumentation = opentelemetry({
	instrumentations: [new PgInstrumentation()]
})
```

```toml
# bunfig.toml
preload = ["./src/instrumentation.ts"]
```

Import the exported `instrumentation` and register `.use(instrumentation)`. Keep instrumented packages external so instrumentation can patch their modules:

```bash
bun build --compile --external pg --outfile server src/index.ts
```

Ship external runtime packages in production `node_modules`. Keep them in `dependencies`.

## Server Timing

```ts
import { Elysia } from 'elysia'
import { serverTiming } from '@elysia/server-timing'

export const app = new Elysia()
	.use(serverTiming({
		allow: ({ request }) => new URL(request.url).pathname !== '/health'
	}))
	.get('/', () => 'Hello')
```

Inspect the response's `Server-Timing` header or the browser Network timing panel. `enabled` defaults to `NODE_ENV !== 'production'`. `allow` is a boolean or a synchronous predicate. The `trace` option selects `request`, `parse`, `transform`, `beforeHandle`, `handle`, `afterHandle`, `error`, `mapResponse`, and `total`.
