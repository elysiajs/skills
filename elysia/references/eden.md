# Eden typed clients

Use Treaty for typed clients, WebSockets, and direct Elysia calls. Use Eden Fetch for a route-string API. Both infer types from a type-only server import without code generation.

- [Setup](#setup)
- [Paths and parameters](#paths-and-parameters)
- [Responses and errors](#responses-and-errors)
- [Client configuration](#client-configuration)
- [Client plugins](#client-plugins)
- [WebSocket](#websocket)
- [Eden Fetch and legacy Treaty](#eden-fetch-and-legacy-treaty)
- [Troubleshooting inference](#troubleshooting-inference)

## Setup

Select compatible `elysia` and `@elysia/eden` releases from [versions.md](versions.md). The client needs Elysia's types, usually as a development dependency. Resolve the same exact Elysia release and enable `strict: true` on both sides.

```ts
// server/app.ts
import { Elysia, t } from 'elysia'

export const app = new Elysia()
	.get('/hi', () => 'Hello')
	.get('/users/:id', ({ params }) => params.id)
	.post('/mirror', {
		body: t.Object({ id: t.Number(), name: t.String() })
	}, ({ body }) => body)

export type App = typeof app
```

```ts
// client.ts
import { treaty } from '@elysia/eden'
import type { App } from './server/app'

const api = treaty<App>('http://localhost:3000')
const { data, error } = await api.mirror.post({ id: 1, name: 'Elysia' })
if (error) throw error
console.log(data.name)
```

The network example requires a server at that origin. Keep `.listen()` in a separate entry file. Use type-only imports in browser clients to exclude server code.

On the server or in a test, pass the instance directly:

```ts
import { treaty } from '@elysia/eden'
import { app } from './server/app'

const api = treaty(app)
const result = await api.hi.get()
```

Instance mode uses `app.handle()` without networking or listening. See [testing.md](testing.md) for runtime and type checks.

## Paths and parameters

| Route | Treaty call |
| --- | --- |
| `GET /` | `api.get()` |
| `GET /hi` | `api.hi.get()` |
| `POST /deep/nested` | `api.deep.nested.post(body)` |
| `GET /users/:id` | `api.users({ id: '1' }).get()` |
| `GET /users/:id/posts` | `api.users({ id: '1' }).posts.get()` |

Pass dynamic segments as objects keyed by parameter name. Include the full prefix, such as `.api.users` for `prefix: '/api'`.

- `get` and `head` take `{ query?, headers?, fetch? }`.
- Body methods take `(body, { query?, headers?, fetch? })`.
- Schemas determine the accepted types and whether query or header fields are required.
- For an optional body with required options, pass `undefined` as the first argument.

```ts
// For a route with body { name: string } and query { page: number }:
await api.users.post({ name: 'Elysia' }, { query: { page: 1 } })

// For a route with an optional body:
await api.search.post(undefined, { query: { name: 'Elysia' } })
```

Per-call `fetch` takes `RequestInit`, including an abort signal:

```ts
await api.hi.get({ fetch: { signal: AbortSignal.timeout(5000) } })
```

Files in the body trigger `multipart/form-data`. Match the server schema. Use a `File` for a required file, and convert a `FileList` to `File[]` for `t.Files()`.

```ts
// Server body schema: t.Object({ images: t.Files() })
const input = document.querySelector<HTMLInputElement>('#images')!
await api.upload.post({ images: Array.from(input.files ?? []) })
```

## Responses and errors

By default, Treaty resolves to `{ data, error, status, response, headers }`.

| Field | Meaning |
| --- | --- |
| `data` | Parsed success body, or `null` on failure |
| `error` | Failure with `status` and `value`, or `null` on success |
| `status` | HTTP status. Transport failures use 503 |
| `response` | Raw `Response`, absent on transport failure |
| `headers` | Response headers, absent on transport failure |

Check `error` before using `data`. Return `status(code, value)` for typed server errors. Thrown errors are absent from the inferred route return type.

```ts
import { Elysia } from 'elysia'
import { treaty } from '@elysia/eden'

const app = new Elysia().get('/users/:id', ({ params, status }) => {
	if (params.id === 'missing') return status(404, { message: 'User not found' })
	return { id: params.id }
})

const { data, error } = await treaty(app).users({ id: 'missing' }).get()
if (error) {
	if (error.status === 404) console.log(error.value.message)
	throw error
}
console.log(data.id)
```

Non-2xx responses become errors. Fetch follows redirects by default, so a redirect may resolve to its destination response. `throwHttpError` can opt into throwing instead. Custom `onResponse` handlers override normal parsing, so only replace data deliberately.

### Streams and utility types

Generator handlers and SSE can return an `AsyncGenerator` in `data`. Handle the error before consuming the stream:

```ts
import { Elysia, sse } from 'elysia'
import { treaty } from '@elysia/eden'

const app = new Elysia().get('/events', function* () {
	yield sse({ event: 'message', data: 'Hello' })
})

const { data, error } = await treaty(app).events.get()
if (error) throw error
for await (const event of data) console.log(event)
```

Extract client types without duplicating server interfaces:

```ts
import type { Treaty } from '@elysia/eden'

type MirrorData = Treaty.Data<typeof api.mirror.post>
type MirrorError = Treaty.Error<typeof api.mirror.post>
```

`Treaty.Data` and `Treaty.Error` also accept a resolved Treaty response type.

## Client configuration

`treaty<App>(origin, options)` accepts these options. Prefer an explicit URL scheme. Inferred schemes use HTTP for local addresses and HTTPS otherwise.

| Option | Behavior |
| --- | --- |
| `fetch` | Default `RequestInit` excluding headers and method, for example `{ credentials: 'include' }` |
| `fetcher` | Custom fetch-compatible function returning a Web Standard `Response` |
| `headers` | Object, `(path, options) => headers`, or array of header functions |
| `onRequest` | Function or array. Returned `RequestInit` values are shallow-merged into the request |
| `onResponse` | Function or array. First non-null, non-undefined return overrides parsed data |
| `parseDate` | Defaults to `true`. Converts recognized date strings to `Date` |
| `throwHttpError` | Defaults to `false`. Accepts `true` or an error predicate |

```ts
const api = treaty<App>('https://api.example.com', {
	fetch: { credentials: 'include' },
	headers: { 'x-client': 'web' },
	throwHttpError: (error) => error.status === 503
})
```

Request hook and header callback paths exclude the hostname. Set default headers through `headers`, not `fetch.headers`. Per-call headers override configured defaults. In a configured header array, later entries override earlier entries. Every header callback and `onRequest` callback runs. `onResponse` stops when a callback returns replacement data or throws.

A custom fetcher must return `Response`; Axios needs an adapter. Per-call `throwHttpError` overrides the client default.

## Client plugins

Eden v2 plugins add client methods and mutation hooks. They do not install server-side [Elysia plugins](composition.md).

```ts
import { Elysia } from 'elysia'
import { createPlugin, treaty } from '@elysia/eden'

const routeInfo = createPlugin({
	name: 'route-info',
	verbs: {
		routePath(context) {
			return context.path
		}
	},
	before(context) {
		console.log('Sending', context.method, context.paths)
	},
	after(result, context) {
		console.log('Received', context.method, result.status)
	}
})

const app = new Elysia().get('/users/:id', ({ params }) => params.id)
const client = treaty(app)
const api = client.use(routeInfo)
api.users({ id: '1' }).routePath() // '/users/1', no request
```

Call `.use()` on the root client and keep the returned client. The previous client stays unchanged. Chain `.use()` to combine plugins.

- Custom verbs receive `path`, `paths`, `domain`, `config`, and `elysia` for an instance client. Additional function parameters become the custom method's parameters.
- `before` and `after` run for `post`, `put`, `patch`, and `delete`, in registration order. They do not run for reads, WebSocket subscriptions, or custom verbs.
- Mutation context contains `paths`, lowercase `method`, request `options`, `config`, and `domain`. `after` receives the usual result shape, including absent `response` and `headers` on transport failure.
- A plugin needs a non-empty name and at least one of `verbs`, `before`, or `after`.
- Verbs cannot duplicate another plugin's verb or reserved names. Reserved names include HTTP methods, `subscribe`, `use`, `~path`, `then`, `catch`, and `finally`.

## WebSocket

Use the v2 `websocket()` server plugin, then call `.subscribe()` on the client route. This connects over WebSocket, even when other Treaty calls use instance mode.

```ts
import { Elysia, t } from 'elysia'
import { websocket } from 'elysia/websocket'
import { treaty } from '@elysia/eden'

const app = new Elysia()
	.use(websocket())
	.ws('/chat', {
		body: t.String(),
		response: t.String(),
		message({ body }) { return body }
	})
	.listen(3000)

const chat = treaty<typeof app>('http://localhost:3000').chat.subscribe()
chat.subscribe((message) => console.log(message.data))
chat.on('open', () => chat.send('Hello'))
```

`subscribe` accepts query options. The `EdenWS` wrapper provides typed `send`, `subscribe`, `on`, `off`, and `close`. Access the native WebSocket through `.ws`. Browser WebSockets cannot send arbitrary custom headers. Use cookies or the server's supported authentication flow.

## Eden Fetch and legacy Treaty

`edenFetch<App>(origin)` uses route patterns and fills parameters separately. It has no WebSocket support.

```ts
import { edenFetch } from '@elysia/eden'
import type { App } from './server/app'

const apiFetch = edenFetch<App>('http://localhost:3000')
await apiFetch('/users/:id', { params: { id: '1' } })
const { data, error } = await apiFetch('/mirror', {
	method: 'POST',
	body: { id: 1, name: 'Elysia' }
})
if (error) throw error
console.log(data.name)
```

Prefer Treaty unless the project uses Fetch or measurements favor Fetch's inference cost. Neither is always faster to type-check.

Treaty 1 uses `edenTreaty`, full URLs, dynamic property access such as `api.users['1'].get()`, and a single object mixing body fields with `$query` and `$fetch`. Preserve that API when maintaining legacy code. For new code, use `treaty` with parameter objects and separate request options.

## Troubleshooting inference

Check these before adding casts or duplicating types:

1. Enable `strict: true` in client and server.
2. Inspect the lockfile and `npm why elysia`, or your package manager's equivalent. Both projects must resolve the same Elysia version. Check plugin peer compatibility and the TypeScript requirements in [versions.md](versions.md).
3. Preserve returned instance types. Chain methods or assign the return to a new variable. Discarding the return, or reassigning to a previously inferred variable, does not extend that variable's type.
4. Resolve server path aliases in the client TypeScript project. Prefer package-specific aliases over conflicting `@/*` mappings.
5. Include needed ambient types. A handler whose return type mentions `Bun.file`, for example, may require `@types/bun` in the client project.
6. Export the completed app chain's type. Run the client's typecheck to catch drift.
