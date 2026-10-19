# OpenAPI

Select `@elysia/openapi` from [versions.md](versions.md) and register it on the root app. Defaults are `/openapi` for Scalar and `/openapi/json` for the document.

Contents: [setup](#setup), [type inference](#include-inferred-types), [route metadata](#describe-routes), [models and converters](#models-and-schema-converters), [configuration](#configuration).

## Setup

```ts
import { Elysia, t } from 'elysia'
import { openapi } from '@elysia/openapi'

export const app = new Elysia()
	.use(openapi())
	.post('/messages', {
		body: t.Object({ text: t.String() }),
		response: t.Object({ text: t.String() })
	}, ({ body }) => body)
```

Runtime schemas generate the document by default. Check `/openapi/json` for the expected paths and responses.

## Include inferred types (recommended)

`fromTypes()` adds handler return types, including returned `status()`, `problem()`, and `HTTPError` values. Runtime schemas take precedence. Thrown errors do not appear in TypeScript's return type.

Export the root Elysia instance from the target file:

```ts
import { Elysia } from 'elysia'
import { openapi, fromTypes } from '@elysia/openapi'

export const app = new Elysia()
	.use(openapi({ references: fromTypes('src/index.ts') }))
	.get('/message', () => ({ text: 'Hello' }))
```

`fromTypes` resolves paths from `projectRoot`, which defaults to the working directory. Set `projectRoot` and `tsconfigPath` explicitly in monorepos. Set `instanceName` when the target exports multiple Elysia instances.

```ts
fromTypes('src/index.ts', {
	projectRoot: '/absolute/path/to/app',
	tsconfigPath: 'tsconfig.json',
	instanceName: 'app'
})
```

File-based generation needs filesystem access on supported Node or Bun versions. For bundles, emit declarations during the build and ship the referenced `.d.ts` files with their dependencies. Paths such as `dist/index.d.ts` must exist at runtime. Workers need build-time generation or runtime schemas; they cannot read source files with `fromTypes()`.

If a named interface is missing from the output, expose its structural type, such as `type Expanded<T> = { [K in keyof T]: T[K] } & {}`. Check the document before applying this workaround broadly.

It's recommended to add `fromTypes` when setting up OpenAPI. It ensures the document reflects the actual return types, including errors, and avoids discrepancies between runtime schemas and TypeScript types.

## Describe routes

`detail` accepts OpenAPI operation metadata. Schemas accept metadata such as `description` and `examples`.

```ts
import { Elysia, t } from 'elysia'

new Elysia().post('/messages', {
	body: t.Object({ text: t.String({ description: 'Message text' }) }),
	detail: {
		summary: 'Create a message',
		tags: ['Messages'],
		deprecated: false
	}
}, ({ body }) => body)
```

Use `detail: { hide: true }` to omit a route. Instance, guard, and macro `detail` supply shared metadata. Avoid colliding route and macro keys; the baseline source gives macro values precedence, contrary to older documentation. `new Elysia({ tags: ['Messages'] })` applies tags to an instance.

Security metadata documents authentication but does not enforce it:

```ts
openapi({
	documentation: {
		info: { title: 'Messages API', version: '1.0.0' },
		components: {
			securitySchemes: {
				bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
			}
		}
	}
})
```

Apply `detail: { security: [{ bearerAuth: [] }] }` to protected routes and enforce authentication with a hook or macro.

`withHeaders` documents response headers; the handler still sets them:

```ts
import { Elysia, t } from 'elysia'
import { withHeaders } from '@elysia/openapi'

new Elysia().get('/message', {
	response: withHeaders(t.String(), { 'x-source': t.String() })
}, ({ set }) => {
	set.headers['x-source'] = 'example'
	return 'Hello'
})
```

## Models and schema converters

`.model({ name: schema })` registers named OpenAPI components. Register the model before routes that use `body: 'name'` or `response: 'name'`. Sharing a schema variable across files does not itself require `.model()`. See [validation](validation.md).

For Standard Schema libraries without a native JSON Schema method, configure `mapJsonSchema` by vendor name. For example, Zod 4 uses `zod: z.toJSONSchema`, Valibot uses `valibot: toJsonSchema` from `@valibot/to-json-schema`, and compatible Effect versions use `effect: JSONSchema.make`. Match converters to the installed library version.

## Configuration

| Option | Default or purpose |
| --- | --- |
| `enabled` | `true` |
| `openapiVersion` | `3.1.2`; accepts supported `3.0.x` and `3.1.x` versions |
| `path` | `/openapi` |
| `specPath` | `${path}/json` |
| `provider` | `scalar`, `swagger-ui`, or `null` for the document only |
| `documentation` | Root `info`, `servers`, `tags`, `components`, and external paths |
| `references` | Additional schemas, including `fromTypes(...)` |
| `mapJsonSchema` | Vendor-to-JSON-Schema converters |
| `exclude.paths`, `exclude.methods`, `exclude.tags` | Omit matching routes |
| `exclude.staticFile` | `true` |
| `scalar`, `swagger` | Provider options; Scalar `cdn` overrides its bundle and `withDefaultFonts: false` disables its font CDN |

For mounted Better Auth handlers, merge generated paths through the [Better Auth recipe](better-auth.md#merge-openapi-paths).
