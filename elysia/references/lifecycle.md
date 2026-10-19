# Lifecycle and request resources

Examples use `Elysia` and `t` from `elysia`. [Composition](composition.md#hook-scope) defines which instance receives a hook. [Errors](errors.md) owns error classification and response disclosure.

- [Stage order](#stage-order)
- [Registration order](#registration-order)
- [Request and parsing](#request-and-parsing)
- [Transform and beforeHandle](#transform-and-beforehandle)
- [Derive](#derive)
- [Disposal](#disposal)
- [Response hooks](#response-hooks)
- [After response and defer](#after-response-and-defer)

## Stage order

| Stage | Instance API | Route option | Effect of a return value |
| --- | --- | --- | --- |
| Request | `.onRequest()` | None | Responds before routing and parsing. |
| Parse | `.onParse()`, `.parser()` | `parse` | Becomes `body`; `undefined` tries the next parser. |
| Transform | `.onTransform()` | `transform` | Mutate request context before validation. |
| Validation | Schemas | `body`, `query`, and other schemas | Invalid requests return 422. |
| Before handle | `.onBeforeHandle()`, `.derive()` | `beforeHandle`, macro `derive` | Runs in registration order. A response skips the handler. Derive objects extend context. |
| Handler | Route method | Handler argument | Becomes the response value. |
| After handle | `.onAfterHandle()` | `afterHandle` | A non-`undefined` value replaces the response and skips remaining after-handle hooks. |
| Map response | `.mapResponse()` | `mapResponse` | Converts the value to a `Response`; a return skips remaining map-response hooks. |
| After response | `.onAfterResponse()` | `afterResponse` | Runs post-response work; cannot change the sent response. |

Errors enter `.onError()` or the route's `error` hook when they occur, not after successful responses. [Tracing](observability.md) measures lifecycle events.

## Registration order

Register hooks before the routes or `.use(plugin)` calls they should affect. Later hooks do not reach earlier routes, even with global scope. `onRequest` is the exception because it runs before route matching and covers earlier routes too.

```ts
const child = new Elysia().get('/child', () => 'child')

new Elysia()
	.onBeforeHandle(() => { console.log('first') })
	.use(child)
	.onBeforeHandle(() => { console.log('second') })
	.get('/parent', () => 'parent')
```

`/child` logs only `first`. `/parent` logs both. A route option applies only to its own route. A plugin's hooks stay local unless promoted through [scope](composition.md#hook-scope).

## Request and parsing

`onRequest` receives the original `request`, `set`, shared state, decorators, and the server when available. Parsed body and headers are not ready. Use `request.headers` for raw headers. A returned response skips parsing, validation, and the handler.

```ts
new Elysia()
	.onRequest(({ request, status }) => {
		if (request.headers.get('x-maintenance') === 'true')
			return status(503, 'Temporarily unavailable')
	})
	.get('/', () => 'ready')
```

Parsers run before validation. The first non-`undefined` result becomes `body`. Parser context includes `contentType`.

| `parse` shorthand | Content type |
| --- | --- |
| `text` | `text/plain` |
| `json` | `application/json` |
| `formdata` | `multipart/form-data` |
| `urlencoded` | `application/x-www-form-urlencoded` |
| `arrayBuffer` | `application/octet-stream` |
| `none` | Skips parsing, leaving the body for another library. |

The route's `parse` also accepts full content types, named custom parsers, or an ordered array. `parse: 'none'` matters when tRPC, oRPC, or another handler must consume the original single-use request body.

```ts
new Elysia()
	.parser('custom', ({ request, contentType }) => {
		if (contentType === 'application/custom') return request.text()
	})
	.post('/input', { parse: ['custom', 'json'] }, ({ body }) => body)
```

`.onParse(fn)` registers a parser without naming it.

## Transform and beforeHandle

`transform` changes existing values before validation. Prefer schema coercion, such as `t.Number()` for path parameters or `z.coerce.number()` with Zod. Use `derive` for typed context after validation.

`beforeHandle` receives validated request data. A returned value skips the handler, but `afterHandle` can still inspect or replace that response.

```ts
new Elysia()
	.get('/private', {
		beforeHandle({ headers, status }) {
			if (headers.authorization !== 'Bearer test-token')
				return status(401, 'Unauthorized')
		}
	}, () => 'authorized')
```

The fixed token demonstrates response flow. Production authentication must use the project's credential verification service.

## Derive

`.derive()` adds typed request values after validation. It shares the `beforeHandle` queue and follows registration order. The returned object extends context; a returned `status()` ends the request. The v1 `.resolve()` API is removed.

```ts
import { Elysia } from 'elysia'

const sessions = new Map([
	['example-session', { id: 'user-1' }]
])

new Elysia()
	.derive(({ cookie, status }) => {
		const token = cookie.session.value
		const user = typeof token === 'string' ? sessions.get(token) : undefined
		if (!user) return status(401, 'Unauthorized')
		return { user }
	})
	.get('/me', ({ user }) => ({ id: user.id }))
```

If a cookie schema requires `session`, a missing cookie fails validation with 422 before derive runs. Make it optional when missing credentials should reach the 401 branch.

Use `.derive('plugin', fn)` to export the derived property to the immediate parent. See [hook scope](composition.md#hook-scope). Route-selective derives belong in [macros](composition.md#macros).

## Disposal

Elysia releases derived values with `Symbol.asyncDispose` or `Symbol.dispose` after the response completes.

```ts
class RequestResource {
	closed = false;
	[Symbol.dispose]() { this.closed = true }
}

new Elysia()
	.derive(() => ({ resource: new RequestResource() }))
	.get('/', ({ resource }) => ({ closed: resource.closed }))
```

- Disposal runs after `afterResponse` and `defer` callbacks, in reverse registration order. `Symbol.asyncDispose` wins when both methods exist.
- Later short-circuits, handler errors, and disconnects still trigger disposal. Streams release resources when the stream ends.
- A resource under several context keys is disposed once per request.
- Existing context values and startup `state` or `decorate` singletons are excluded. Returning a singleton through derive does not make it a request resource.
- A value placed into `store` later at runtime is not recognized as a startup singleton. Keep shared resources in startup `state` or `decorate` registrations.
- Disposer failures are logged with `console.error`; they cannot change the sent response.
- WebSocket upgrade resources live until the connection closes.
- Shared resources need explicit shutdown cleanup through `.onStop()`.

## Response hooks

`responseValue` holds the current returned value in `afterHandle`, `mapResponse`, and `afterResponse`. The old `response` property is removed.

```ts
new Elysia()
	.mapResponse(({ responseValue }) => {
		if (typeof responseValue === 'string' && responseValue.startsWith('<h1>'))
			return new Response(responseValue, {
				headers: { 'content-type': 'text/html; charset=utf-8' }
			})
	})
	.get('/', () => '<h1>Hello</h1>')
```

Elysia merges `set.headers` into the mapped response. A returned `Error` from `afterHandle` enters error handling, as it does from a handler. Returning `status()` or `problem()` sends an ordinary response. See [errors.md](errors.md) for class-specific hooks.

## After response and defer

Use `.onAfterResponse(fn)` for shared post-response work and context `defer(fn)` for request-specific work.

```ts
new Elysia()
	.get('/', ({ defer }) => {
		defer(({ set }) => { console.log('sent', set.status) })
		return 'ok'
	})
```

`afterResponse` runs first, then deferred callbacks, then resource disposal. Deferred callbacks scheduled during the deferred drain do not run in that drain. Callback errors are logged.

`responseValue` may still be the original handler value. `set` contains context-assigned headers and status, not every header or status supplied directly by a returned `Response` or runtime.

`.onStart(fn)` and `.onStop(fn)` receive the app during server startup and shutdown. Clean up shared resources in `onStop`, separately from request disposal.
