# Plugins, scope, guards, and macros

Examples use `Elysia` and `t` from `elysia`. See [lifecycle.md](lifecycle.md) for hook timing and [validation.md](validation.md) for schema behavior.

- [Dependencies and plugin identity](#dependencies)
- [Hook scope](#hook-scope)
- [Guards and groups](#guards-and-groups)
- [Async modules and mounting](#async-modules-and-mounting)
- [Macros](#macros)
- [Macro type lambdas](#macro-type-lambdas)

## Dependencies

Every Elysia instance can be a plugin. `.use(plugin)` imports its routes and shared types. An independently defined consumer needs its own `.use(dependency)` for TypeScript to infer the dependency. A parent's decorators can reach a child at runtime, but registering them only on the parent does not add them to the independently defined child's static type.

```ts
const service = new Elysia({ name: 'service' })
	.decorate('greet', (name: string) => `Hello ${name}`)

const users = new Elysia({ prefix: '/users' })
	.use(service)
	.get('/:name', ({ greet, params }) => greet(params.name))

const app = new Elysia().use(users)
```

Declare service, state, model, and macro dependencies explicitly. Use global hooks for CORS, logging, and tracing. They do not replace typed `.use()` dependencies.

Plugin factories normally return new instances. Functional plugins receiving `(app: Elysia)` also work, but returned instances have clearer scope and inference boundaries.

## Plugin identity

`name` and `seed` identify plugins for hook deduplication. Use stable names. Put configuration in `seed` so equal configurations deduplicate and different ones stay distinct.

```ts
const version = (value: number) => new Elysia({ name: 'version', seed: value })
	.get('/version', value)
```

Deduplication prevents repeated registration, not factory execution. Allocate shared resources outside repeated factory calls.

## Hook scope

The first hook argument can be `'local'`, `'plugin'`, or `'global'`. Omit it for local scope. The old `'scoped'` string throws. The old `{ as: 'global' }` form warns.

For `main.use(parent)`, `parent.use(current)`, and `current.use(child)`:

| Scope declared on `current` | `child` | `current` | `parent` | `main` |
| --- | --- | --- | --- | --- |
| `local` | Yes | Yes | No | No |
| `plugin` | Yes | Yes | Yes | No |
| `global` | Yes | Yes | Yes | Yes |

This table assumes hooks precede the routes and `.use()` calls they must affect. Scope never makes ordinary hooks reach earlier registrations. [Registration order](lifecycle.md#registration-order) documents the `onRequest` exception.

```ts
const identity = new Elysia({ name: 'identity' })
	.derive('plugin', () => ({ serviceName: 'catalog' }))

new Elysia()
	.use(identity)
	.get('/name', ({ serviceName }) => serviceName)
```

Export hooks in three ways:

- A scope argument, such as `.derive('plugin', fn)`, applies to that hook.
- `.guard('plugin', options)` exports the guard's hooks and schemas.
- `.as('plugin')` or `.as('global')` promotes hooks and schema scopes already registered on the instance.

`plugin` reaches one parent. Promoting that parent again can extend the hooks another level. For a typed derived property, use `.derive(scope, fn)` rather than placing it in guard options.

## Guards and groups

A guard applies route options to a set of routes:

| Form | Affected routes |
| --- | --- |
| `.guard(options)` | Following routes in the instance. |
| `.guard(options, app => app...)` | Routes inside the callback. |
| `.group(prefix, app => app...)` | Callback routes receive the prefix. |
| `.group(prefix, options, app => app...)` | Callback routes receive the prefix and shared options. |

```ts
new Elysia()
	.group('/v1', {
		query: t.Object({ page: t.Optional(t.Number()) })
	}, app => app.get('/items', ({ query }) => ({ page: query.page ?? 1 })))
	.get('/health', () => 'ok')
```

In v2, a route's schema replaces the corresponding inherited guard schema. Set `schema: 'merge'` on the guard when both schemas must apply. Enabled macro schemas compose separately with route schemas. See [validation.md](validation.md).

## Async modules and mounting

A synchronous plugin registers immediately. An async plugin registers after its promise settles. `.listen()` and `app.fetch()` wait for pending modules. `app.handle()` can run before they settle, so tests must await `app.modules`.

```ts
const app = new Elysia()
	.use(async app => app.get('/async', () => 'ready'))

await app.modules
const response = await app.handle('/async')
```

`.use(import('./plugin'))` defers loading and registration. The module must default-export a plugin.

`.mount(path, fetchHandler)` hosts another Web Standard `Request`-to-`Response` application. Use `.use()` for Elysia-to-Elysia composition so types and scopes carry across. Other frameworks can host Elysia through `app.fetch`. Adapter and deployment requirements still depend on the runtime; see [runtimes.md](runtimes.md).

## Macros

`.macro({ name: definition })` defines typed route options. The removed `.macro(name, definition)` overload is invalid in v2. Enable macros in the route options before the handler.

An object definition is a boolean option. A function definition receives the option value.

```ts
new Elysia()
	.macro({
		withRequestId: {
			derive: () => ({ requestId: crypto.randomUUID() })
		},
		log: (label: string) => ({
			beforeHandle() { console.log(label) }
		})
	})
	.get('/', { withRequestId: true, log: 'home' }, ({ requestId }) => requestId)
```

`withRequestId: false` disables the object macro. A macro can supply hooks, schemas, derived context, and other macro options.

### Authentication and derived values

Use macro `derive` for a typed request value, replacing the v1 `resolve` key. Return an expected error response so Eden and OpenAPI type generation can infer it. An unhandled generic `Error` returns 500.

```ts
import { Elysia, status } from 'elysia'

const sessions = new Map([['example-session', { id: 'user-1' }]])

const auth = new Elysia({ name: 'auth' })
	.macro({
		auth: {
			derive({ headers }) {
				const token = headers.authorization?.match(/^Bearer (.+)$/)?.[1]
				const user = token ? sessions.get(token) : undefined
				if (!user) return status(401, 'Unauthorized')
				return { user }
			}
		}
	})

new Elysia()
	.use(auth)
	.get('/me', { auth: true }, ({ user }) => ({ id: user.id }))
```

The session map makes this example self-contained. Use the project's credential verification service in production.

### Schema and macro composition

Macro schemas combine with the route's schema and other enabled macro schemas. Standard Schema validators also work. Each macro's hooks infer its own schema.

```ts
new Elysia()
	.macro({
		withAge: {
			body: t.Object({ age: t.Number() }),
			beforeHandle({ body }) { console.log(body.age) }
		}
	})
	.post('/people', {
		withAge: true,
		body: t.Object({ name: t.String() })
	}, ({ body }) => ({ name: body.name, age: body.age }))
```

A macro can enable an earlier macro and add its own context:

```ts
new Elysia()
	.macro({ withUser: { derive: () => ({ user: 'lilith' }) } })
	.macro({
		withMember: {
			withUser: true,
			derive: () => ({ role: 'member' })
		}
	})
	.get('/', { withMember: true }, ({ user, role }) => ({ user, role }))
```

A macro's hooks do not infer another macro's derived properties. Keep dependent calculations in one derive or use the combined properties in the handler.

### Deduplication and limits

Repeated macro hooks deduplicate. A function macro's identity uses its name and seed; the option value is the default seed. Return a stable `seed` to override it. Circular option objects need a separate serializable seed.

Nested macro expansion has a 16-level guard. Avoid cyclic dependencies. Route and macro OpenAPI `detail` merge, but the verified source and documentation disagree on collision precedence. Avoid colliding keys.

## Macro type lambdas

Function macros can return `$type: macroType<Lambda>()` to calculate context types from the route's option value.

```ts
import { Elysia, macroType, type MacroTypeLambda } from 'elysia'

interface Role extends MacroTypeLambda {
	output: Record<'role', this['input']>
}

new Elysia()
	.macro({
		role: (role: 'admin' | 'member') => ({
			$type: macroType<Role>(),
			derive: () => ({ role })
		})
	})
	.get('/admin', { role: 'admin' }, ({ role }) => role)
```

The handler's `role` is the literal `'admin'`. Literal preservation requires literal constraints in the macro parameter, such as `'admin' | 'member'` or a template literal type.

`output` describes added context. `$type` has no runtime effect, and TypeScript does not check that derive returns the promised `output`. The macro must provide the value. Use `Record` when referring to `this` within an output object type.

A lambda's `option` can type a callback from the route's context:

```ts
import { Elysia, macroType, t, type Context, type MacroTypeLambda } from 'elysia'

interface Log extends MacroTypeLambda {
	option: (context: this['context']) => string
}

new Elysia()
	.macro({
		log: (message: (context: Context) => string) => ({
			$type: macroType<Log>(),
			beforeHandle(context) { console.log(message(context)) }
		})
	})
	.post('/users/:id', {
		body: t.Object({ name: t.String() }),
		log: ({ params, body }) => `${params.id}: ${body.name}`
	}, ({ body }) => body)
```

- `this['context']` includes the route schema, path parameters, earlier decorators and derives, and macros enabled by an earlier guard.
- It excludes macros enabled alongside this option, including its own derive, output, and schema.
- The callback's declared implementation type must remain compatible with the hook context passed at runtime.
- Type lambdas also apply to guards, groups, and WebSockets. A group context includes prefix parameters, not child-route parameters.
- Use `this['input']` in `output` and `this['context']` in `option`. Each is `unknown` in the other position. A lambda can define both.
