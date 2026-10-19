# Project structure

Keep the project's organization. Otherwise, group routes by feature and split schemas or business logic as needed. Elysia requires no MVC, controller classes, or dependency injection container.

A growing feature can use this layout:

```text
src/
  app.ts                 Compose and export the application without listening
  index.ts               Export app and start the process
  routes/user/
    index.ts             Routes and HTTP behavior
    model.ts             Request and response schemas with derived types
    service.ts           Business rules and data access
  plugins/               Shared Elysia behavior, such as authentication macros
  libs/                  Shared clients and helpers
test/
  user.test.ts
```

Keep small features in one file and feature-specific helpers nearby. Add shared folders when callers need them.

## Separate composition from startup

These files form a minimal app. Tests and in-process Eden clients import `app.ts` without listening. The startup entry exports `app` for AOT discovery.

```ts
// src/app.ts
import { Elysia } from 'elysia'

export const app = new Elysia().get('/health', () => 'ok')
export type App = typeof app
```

```ts
// src/index.ts
import { app } from './app'

export { app }
app.listen(3000)
```

For a larger app, import feature instances into `app.ts` and chain `.use(feature)`. Deployment and AOT setup are in [deploy.md](deploy.md).

## Keep route context in the controller

Handlers own validation, headers, cookies, redirects, and status codes. Pass required values to services instead of the whole context. A bare `Context` annotation loses inferred schema and plugin types.

These three files form a complete feature. Mount `user` with `.use(user)` in `app.ts`.

```ts
// src/routes/user/model.ts
import { t, type UnwrapModels } from 'elysia'

export const ByIdGet = {
	Params: t.Object({ id: t.String() }),
	Response: t.Object({ id: t.String(), name: t.String() })
}
export type ByIdGet = UnwrapModels<typeof ByIdGet>
```

```ts
// src/routes/user/service.ts
import type * as UserModel from './model'

export function getUser(id: UserModel.ByIdGet['Params']['id']) {
	return { id, name: 'Ada' } satisfies UserModel.ByIdGet['Response']
}
```

```ts
// src/routes/user/index.ts
import { Elysia } from 'elysia'
import * as UserModel from './model'
import { getUser } from './service'

export const user = new Elysia({ prefix: '/user' })
	.get('/:id', {
		params: UserModel.ByIdGet.Params,
		response: UserModel.ByIdGet.Response
	}, ({ params }) => getUser(params.id))
```

## Model conventions

`model.ts` defines the API contract, not database tables. Derive types from its schemas instead of duplicating interfaces.

One useful naming convention is `[Pathname][Method]` relative to the feature prefix. `POST /` becomes `Post`; `GET /:id` becomes `ByIdGet`. Group the route's `Body`, `Params`, `Query`, `Headers`, `Cookie`, and `Response` schemas under that name. Export the same-named `UnwrapModels` type and import the module as `UserModel`.

`UserModel.ByIdGet.Params` accesses a schema; `UserModel.ByIdGet['Params']` accesses its type. Follow existing naming conventions when present. Inline schemas are fine for a single route. Use `.model()` registration when string references or named OpenAPI components are useful, as described in [validation.md](validation.md#models-and-types).

Generated database schemas need an explicit public field selection. Check [Drizzle](drizzle.md) or [Prisma](prisma.md) for compatible schema generators.

## Services and dependencies

Services can query databases, enforce ownership, or run transactions directly. Add another layer only when it has a separate responsibility. Return expected HTTP failures with `status()` or a shared `HTTPError.id()` class when the service is HTTP-specific. If a service is transport-independent, map its result at the route boundary. See [errors.md](errors.md) for typed failures.

Name shared HTTP plugins for deduplication. Use `decorate` for app-lifetime dependencies and `derive` for request dependencies. Chain calls or bind each result to a new variable to preserve its types.

Disposable values created by `derive` are released after the response. Decorated and state values are not automatically disposed; release shared resources in `onStop`. Scope, macros, and cleanup belong in [composition.md](composition.md) and [lifecycle.md](lifecycle.md).

Test services directly and controllers through `app.handle()` or `treaty(app)`. See [testing.md](testing.md).
