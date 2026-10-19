# Routing, context, and responses

Check the [version policy](versions.md) before using these v2 APIs. Examples import `Elysia` and `t` from `elysia` unless shown otherwise.

- [Configuration](#configuration)
- [Server and request dispatch](#server-and-request-dispatch)
- [Routing](#routing)
- [Context and shared values](#context-and-shared-values)
- [Responses](#responses)
- [Files and streams](#files-and-streams)

Related references own [validation](validation.md), [lifecycle](lifecycle.md), [composition](composition.md), [errors](errors.md), [cookies](cookie.md), [WebSockets](websocket.md), and [runtime builds](runtimes.md).

## Configuration

```ts
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/v1', strictPath: true })
	.get('/health', () => ({ ok: true }))
```

| Option | Default | Effect |
| --- | --- | --- |
| `prefix` | None | Prefixes every route in the instance. |
| `name`, `seed` | None | Identify a plugin for [deduplication](composition.md#plugin-identity). |
| `adapter` | Runtime-dependent | Use `node()` from `@elysia/node` on Node. Bun selects its adapter during `.listen()`. See [runtimes.md](runtimes.md). |
| `strictPath` | `false` | Accepts either trailing-slash form. `true` requires the registered form. |
| `precompile` | `false` | `true` compiles all routes before listening. Set on the root instance. `app.compile()` compiles at call time. |
| `nativeStaticResponse` | `true` | Allows optimized static responses. Bun installs eligible values into `Bun.serve.routes`. |
| `abortSignal` | `true` | Checks request cancellation between lifecycle stages and stops processing with an empty response. |
| `normalize` | `true` | Removes unknown properties from TypeBox objects that disallow them. `true` and `'exactMirror'` use exact-mirror. `'typebox'` uses TypeBox cleaning. `false` rejects disallowed properties. Does not apply to Standard Schema validators. |
| `sanitize` | None | Function or array applied to schema-defined strings. Requires root-level exact-mirror normalization. |
| `allowUnsafeValidationDetails` | `false` | Allows detailed production validation errors when `true`. See [errors.md](errors.md). |
| `cookie` | None | Cookie defaults and signing configuration. See [cookie.md](cookie.md). |
| `tags`, `detail` | None | OpenAPI metadata shared by the instance's routes. |
| `serve` | None | Default Bun server options, overridden by matching `.listen()` options. |

See [migration.md](migration.md) for removed constructor options, including `aot`, `systemRouter`, and `websocket`.

## Server and request dispatch

```ts
const app = new Elysia({ serve: { idleTimeout: 60 } })
	.get('/', () => 'Hello')
	.listen({ port: 3000, hostname: '0.0.0.0' })
```

| API | Behavior |
| --- | --- |
| `.listen(port)` | Starts the runtime server. Also accepts an options object and a callback receiving the server. |
| `app.fetch(request)` | Web Standard fetch handler for hosting Elysia in another runtime or framework. Waits for pending modules. |
| `app.handle(request)` | Dispatches without opening a port. Returns `Promise<Response>`. |
| `app.handle('/path', init?)` | Path shorthand with optional `RequestInit`. |
| `await app.modules` | Waits for async plugins and dynamic imports. Required before testing pending routes through `app.handle()`. `.listen()` and `app.fetch` already wait. |

A `Request` needs an absolute URL, such as `new Request('http://localhost/users')`. Unmatched paths return 404. See [testing.md](testing.md).

Bun server options commonly used through `serve` or `.listen()`:

| Option | Use |
| --- | --- |
| `port`, `hostname` | TCP address. Default hostname is `0.0.0.0`. Default port uses Bun's configured environment port, otherwise `3000`. |
| `idleTimeout` | Seconds of inactivity, not a total request deadline. |
| `maxRequestBodySize` | Byte limit, default 128 MiB. WebSocket payload limits are separate. |
| `unix` | Unix socket instead of hostname and port. |
| `reusePort` | Requests `SO_REUSEPORT` where supported. Elysia does not force it on. |
| `id` | Hot-reload identity. `null` disables hot reload. |
| `tls` | Bun TLS options. Supply both `cert` and `key`, for example `Bun.file('cert.pem')` and `Bun.file('key.pem')`. Client-certificate options such as `rejectUnauthorized` belong inside `tls`. |

Elysia forwards TLS options to the runtime. Check the installed runtime's TLS semantics.

## Routing

Use `.get(path, options, handler)` in v2. Omit unused `options`. A handler is a static value or a function receiving context.

```ts
new Elysia()
	.get('/health', 'ok')
	.get('/users/:id', {
		params: t.Object({ id: t.Number() })
	}, ({ params }) => ({ id: params.id }))
	.post('/users', {
		body: t.Object({ name: t.String() })
	}, ({ body, status }) => status(201, body))
```

| Path | Matched value |
| --- | --- |
| `/users/me` | Static route. |
| `/users/:id` | `params.id`. |
| `/users/:id?/profile` | Optional `params.id`, absent on `/users/profile`. |
| `/users/*` | `params['*']`, including remaining path segments. Wildcards end the path. |

Priority is static, then dynamic, then wildcard. Request parameters start as strings unless a schema coerces them.

- Standard helpers include `.get`, `.post`, `.put`, `.patch`, `.delete`, `.head`, and `.options`.
- `.query(path, options?, handler)` registers the HTTP `QUERY` verb. It does not configure query-string validation.
- `.method('M-SEARCH', path, options?, handler)` registers a custom method.
- `.all(path, options?, handler)` matches every method.
- `.group('/users', app => app.get('/me', ...))` prefixes routes inside its callback. A constructor `prefix` covers the whole instance.
- A group's optional middle argument supplies shared route options. See [guards](composition.md#guards-and-groups).
- `.ws()` requires the [WebSocket plugin](websocket.md).

Chain calls or bind the returned instance to a **new** variable. Reassigning `let app = new Elysia()` cannot widen its inferred type.

```ts
const base = new Elysia().decorate('serviceName', 'catalog')
const app = base.get('/name', ({ serviceName }) => serviceName)
```

## Context and shared values

Field availability depends on the [lifecycle stage](lifecycle.md#stage-order).

| Field | Contents |
| --- | --- |
| `body`, `query`, `params`, `headers` | Parsed request data, with types from route schemas. |
| `cookie` | Cookie accessors. Read `.value`; use helpers to send updates. See [cookie.md](cookie.md). |
| `request` | Original Web Standard `Request`, including URL, raw headers, and abort signal. Its body can be consumed only once. |
| `path` | Actual pathname without the query string. |
| `route` | Registered route pattern when available. It can be `undefined` for static routes. Use `path` when the actual pathname is needed. |
| `store` | Shared mutable values registered by `.state()`. |
| `server` | Running runtime server, or absent when dispatched without one. On Bun, `server?.requestIP(request)` returns socket address information. |
| `set` | Outgoing headers and default status. |
| `status`, `problem`, `redirect` | Response helpers. |
| `defer` | Schedules request-specific [post-response work](lifecycle.md#after-response-and-defer). |
| `responseValue` | Current returned value during response hooks. It is not always a `Response`. |
| `error` | Error available in an error hook. |
| `contentType` | Request content type available during parsing. |

| Context extension | Lifetime | Typical use |
| --- | --- | --- |
| `.state(key, value)` | Shared after registration | Mutable application state, accessed through `store`. |
| `.decorate(key, value)` | Shared after registration | Services, database clients, and helpers. Object and mapping-function forms also exist. |
| `.derive(fn)` | Per request after validation | Session users and request resources. See [derive](lifecycle.md#derive). |

```ts
new Elysia()
	.state('requests', 0)
	.decorate('greet', (name: string) => `Hello ${name}`)
	.derive(({ query }) => ({ name: query.name ?? 'friend' }))
	.get('/', ({ store, greet, name }) => {
		store.requests++
		return greet(name)
	})
```

Keep request values out of `store` and decorated objects. The `app.store` getter is removed. See [composition.md](composition.md) for dependencies and propagation.

## Responses

Strings become text, objects become JSON, and `Response` values retain explicit response behavior. Elysia also accepts `status()`, `problem()`, files, forms, and generators.

Static-value handlers are precomputed. In the verified version, their precomputed headers can override `set.headers` writes from hooks. Use a function handler when hooks must control response headers.

### Status and headers

Return `status(code, body)` to pair a status with its response type. `status('Conflict', body)` also works. Use the context helper or the `elysia` export.

```ts
new Elysia()
	.get('/tea', {
		response: {
			200: t.Object({ name: t.String() }),
			404: t.String()
		}
	}, ({ query, status }) => {
		if (query.name !== 'earl-grey')
			return status(404, 'Tea not found')
		return { name: 'Earl Grey' }
	})
```

`set.headers['x-example'] = 'value'` writes a header. `set.status = 201` sets a default status without the status-to-body type relationship. A returned `status()` takes precedence over `set.status`.

For expected rejections, return `status()` or `problem()`. Returned or thrown `Error` instances enter error hooks. A generic `Error('Unauthorized')` is a 500 unless explicitly handled. See [errors.md](errors.md) for typed errors and production disclosure rules.

### Redirects

Return `redirect('/new-path', 301)` to set the `Location` header. The default status is 302.

## Files and streams

```ts
import { Elysia, file, form, sse } from 'elysia'

new Elysia()
	.get('/portrait', () => file('portrait.webp'))
	.get('/album', () => form({
		name: 'Album',
		images: [file('portrait.webp')]
	}))
	.get('/events', function* () {
		yield sse('Preparing')
		yield sse({ event: 'ready', data: { ready: true } })
	})
```

`form()` creates a multipart response with text and file fields, one level deep. Use `file()` directly for one file.

Generator handlers stream each yielded value. Use `async function*` when producing chunks requires `await`. `sse()` formats events and sets `text/event-stream`.

- Set headers before the first yield. Later changes cannot reach the client.
- Returning before the first yield sends a normal response.
- Client cancellation closes the generator, but cannot cancel an operation already awaiting completion. Pass `request.signal` to operations that support cancellation.
- Per-request disposable resources remain alive until the stream ends. See [disposal](lifecycle.md#disposal).
- Eden exposes streams as async generators. See [eden.md](eden.md).
