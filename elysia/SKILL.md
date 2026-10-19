---
name: elysiajs
description: Build, debug, or migrate Elysia v2 TypeScript backends with validation, plugins, typed clients, and deployment. Use for Elysia projects or explicit Elysia requests.
---

# Elysia v2

## Start here

1. Inspect `package.json`, the lockfile, runtime, and app structure. Keep existing versions and conventions unless the user requests a migration.
2. This skill describes **2.0.0-rc.0** or newer. For v1, use [migration](references/migration.md) to recognize differences, not as permission to upgrade. Check installed types when a different beta disagrees.
3. Read only the references the task needs. [Versions](references/versions.md) lists the source revision, package baselines, and verification limits.
4. Check types and exercise the affected route, including its rejection path. See [testing](references/testing.md).

## Essential rules

- **Options precede the handler.** `.get(path, options, handler)`, `.get(path, handler)`, and `.get(path, staticValue)` are valid.
- **Keep the returned type.** Chain calls or bind the result to a new variable. Reassigning `let app = new Elysia()` does not widen its inferred type.
- **Order hooks before routes.** Parent hooks before `.use(child)` reach the child's routes. `onRequest` runs before routing and is the exception to registration order. See [lifecycle](references/lifecycle.md).
- **Declare typed dependencies.** Each independently defined instance should `.use()` its providers. Parent runtime inheritance does not give a child those static types. See [composition](references/composition.md).
- **Name shared plugins.** `name` and `seed` deduplicate hooks. Plugin factories still execute on each call.
- **Return expected failures.** `status()` and `problem()` send ordinary responses. A returned `Error` enters error hooks and contributes to the route's return type. Thrown errors are absent from that inferred type. Explicit error details can remain public in production. See [errors](references/errors.md).
- **Infer types from schemas.** Use `UnwrapSchema` or `UnwrapModels`. TypeBox 1.x has no schema `.static`. Keep handlers inline and pass plain values to services.
- **Choose context lifetime.** `decorate` and `state` are shared. `derive` runs per request after validation, in the `beforeHandle` queue.
- **Guard schemas override by default.** A route replaces the corresponding inherited schema. Use `schema: 'merge'` on the guard when both must apply.
- **Register optional capabilities.** File MIME validation needs a detector. WebSockets need `elysia/websocket`. Node needs `@elysia/node` and Node 22.18 or newer.
- **Always consult with an actual documentation** for the latest features, examples, and references. The skill is a guide to the documentation, not a replacement.

For Elysia 1 use: https://elysiajs.com/llms.txt
For Elysia 2 use: https://next.elysiajs.com/llms.txt

## Minimal app and test

Use the project's test runner. This Bun example opens no port.

```ts
// src/app.ts
import { Elysia, t } from 'elysia'

export const app = new Elysia()
	.get('/users/:id', {
		params: t.Object({ id: t.Number() })
	}, ({ params }) => ({ id: params.id }))

export type App = typeof app
```

```ts
// test/app.test.ts
import { expect, test } from 'bun:test'
import { app } from '../src/app'

test('coerces the id and rejects nonnumeric input', async () => {
	const response = await app.handle('/users/42')
	expect(response.status).toBe(200)
	expect(await response.json()).toEqual({ id: 42 })
	expect((await app.handle('/users/nope')).status).toBe(422)
})
```

Run `bun test` and the project's type check. For new projects, see [runtime setup](references/runtimes.md). Keep `.listen()` in the process entry. See [project structure](references/project-structure.md).

## Choose a reference

| Task | Read |
| --- | --- |
| Versions, peer dependencies, source versus docs | [Versions](references/versions.md) |
| Configuration, routing, context, files, streams | [Core API](references/api.md) |
| Hooks, parsing, derived context, disposal | [Lifecycle](references/lifecycle.md) |
| Plugins, hook scope, guards, macros | [Composition](references/composition.md) |
| Schemas, coercion, uploads, inferred types | [Validation](references/validation.md) |
| Expected errors, exception mapping, production responses | [Errors](references/errors.md) |
| Folders, services, models, dependency injection | [Project structure](references/project-structure.md) |
| Cookie values, validation, signing | [Cookies](references/cookie.md) |
| WebSocket routes | [WebSockets](references/websocket.md) |
| Route tests, type checks, lazy plugins | [Testing](references/testing.md) |
| Typed client calls | [Eden](references/eden.md) |
| OpenAPI schemas and documentation | [OpenAPI](references/openapi.md) |
| Bun, Node, Deno, Workers, frontend framework integration | [Runtimes](references/runtimes.md) |
| Bundles, AOT, binaries, Docker, deployment | [Deployment](references/deploy.md) |
| Traces, spans, request timing | [Observability](references/observability.md) |
| CORS, JWT, static files, cron, HTML, GraphQL | [Official plugins](references/plugins.md) |
| Databases and external libraries | [Drizzle](references/drizzle.md), [Prisma](references/prisma.md), [Better Auth](references/better-auth.md), [AI SDK](references/ai-sdk.md), [React Email](references/react-email.md) |
| v1 syntax and migration | [Migration](references/migration.md) |
| Find an example by pattern | [Pattern index](references/cheat-sheet.md) |

## Defaults for a new project

Default to Bun and `t` schemas. Keep small apps in one file; split by feature as needed. Add Eden for typed clients and OpenAPI for API documentation.
