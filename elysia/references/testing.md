# Testing Elysia routes

Use the project's test runner. `app.handle()` tests routing, hooks, validation, and response conversion without listening. These examples use Bun.

## Request and response assertions

```ts
import { expect, test } from 'bun:test'
import { Elysia, t } from 'elysia'

const app = new Elysia()
	.post('/users', {
		body: t.Object({ name: t.String({ minLength: 1 }) })
	}, ({ body, status }) => status(201, body))

test('creates a user', async () => {
	const response = await app.handle('/users', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name: 'Ada' })
	})

	expect(response.status).toBe(201)
	expect(await response.json()).toEqual({ name: 'Ada' })
})

test('rejects invalid input', async () => {
	const response = await app.handle('/users', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ name: '' })
	})

	expect(response.status).toBe(422)
})
```

Run with `bun test`. `app.handle(new Request('http://localhost/users', init))` is equivalent. Constructed `Request` URLs must be absolute.

Test the changed behavior, including rejection statuses and hook scope where relevant. Use function handlers for hook-set headers; static values have a [header caveat](api.md#responses).

## Async plugins

Await pending modules before calling `app.handle()`, or deferred routes may return 404.

```ts
const app = new Elysia().use(async app => app.get('/async', () => 'ready'))
await app.modules
const response = await app.handle('/async')
expect(await response.text()).toBe('ready')
```

`app.fetch()` and `.listen()` wait for modules themselves.

## Typed client tests

Pass the app directly to Eden Treaty without a network server:

```ts
import { treaty } from '@elysia/eden'

const app = new Elysia().get('/hello', () => 'hi')
const { data, error } = await treaty(app).hello.get()
expect(error).toBeNull()
expect(data).toBe('hi')
```

See [eden.md](eden.md) for error narrowing, streaming, and configuration. Run the TypeScript build after changing route schemas, macros, or exported app types.
