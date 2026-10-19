# Validation

Route schemas validate inputs and infer handler types. They also feed [OpenAPI](openapi.md). Options precede the handler in v2.

Contents: [slots](#schema-slots), [coercion](#coercion), [Standard Schema](#standard-schema), [files](#files), [models and types](#models-and-types).

## Schema slots

| Option | Validates |
| --- | --- |
| `body` | Parsed request body |
| `query` | Query string |
| `params` | Path parameters |
| `headers` | Request headers |
| `cookie` | Incoming cookies, with typed `.value` access; see [cookies](cookie.md) |
| `response` | Handler result, using one schema or a status-to-schema map |

```ts
import { Elysia, t } from 'elysia'

export const app = new Elysia()
	.get('/users/:id', {
		params: t.Object({ id: t.Number() }),
		query: t.Object({ name: t.String() }),
		response: t.Object({ id: t.Number(), name: t.String() })
	}, ({ params, query }) => ({ id: params.id, name: query.name }))
```

`/users/42?name=Ada` passes with numeric `params.id`. Missing `name` or a nonnumeric `id` returns `422`. Response schema failures return `500`. See [errors.md](errors.md#validation-errors) for shapes and messages.

## TypeBox schemas

Import `t` from `elysia`. It combines TypeBox 1.x with HTTP-specific types. Common TypeBox builders include `String`, `Number`, `Boolean`, `Object`, `Array`, `Literal`, `Union`, `Optional`, and `Partial`. Constraints use JSON Schema options such as `minimum`, `minLength`, `format`, and `maxItems`.

| Elysia builder | Behavior |
| --- | --- |
| `t.Numeric(options)` | Accepts a number or numeric string; decodes to number |
| `t.BooleanString()` | Accepts a boolean or `'true'`/`'false'`; decodes to boolean |
| `t.ObjectString({ ... })` | Accepts an object or its JSON string; decodes to object |
| `t.UnionEnum(['a', 'b', 1])` | Union of the listed literals |
| `t.Nullable(schema)` | Schema or `null` |
| `t.MaybeEmpty(schema)` | Schema, `null`, or `undefined`; not automatically an empty string |
| `t.File(options)` / `t.Files(options)` | One file or multiple files in one field |
| `t.Cookie({ ... }, options)` | Cookie schema with cookie configuration |
| `t.Form({ ... })` | FormData response created with `form()`; see [responses](api.md) |
| `t.Uint8Array()` | Accepts ArrayBuffer or Uint8Array; decodes to Uint8Array |
| `t.ArrayBuffer()` | Accepts ArrayBuffer without conversion |

TypeBox 1.x uses `t.Codec`, not `t.Transform`. `t.Recursive`, `t.Not`, and `t.RegExp` are not exported. Schemas have no `.static` property. See [migration.md](migration.md) for v1 changes.

## Coercion

Elysia automatically coerces route inputs through TypeBox schemas. Standalone schemas get no route conversion.

- Direct number and boolean fields in params, query, and headers accept their string representations.
- Root numeric and boolean bodies also accept string representations.
- Properties inside JSON body objects retain their declared types. With `body: t.Object({ count: t.Number() })`, `{"count": "1"}` fails and `{"count": 1}` passes.
- Use `t.Numeric`, `t.BooleanString`, or `t.ObjectString` for conversion beyond those defaults.

### Query arrays and optional input

An array schema accepts comma-separated and repeated keys. Both `?name=ada,lin` and `?name=ada&name=lin` become `['ada', 'lin']` with `name: t.Array(t.String())`. Without an array schema, a comma-separated value stays a string and a repeated key keeps its last value.

`t.Optional` can wrap a field or an entire request schema. `query: t.Optional(t.Object({ name: t.String() }))` permits an absent query; a nonempty query still needs `name`.

### Extra properties

Header schemas allow undeclared headers by default. `additionalProperties: false` rejects them, including ordinary browser headers, so use it deliberately. Cookie schemas also allow extra names by default.

TypeBox response schemas validate the result and, under the default normalization setting, remove undeclared fields. Standard Schema output follows the chosen validator's behavior. Do not depend on a database row's sensitive fields being safe without a defined output contract.

## Responses by status

Return `status(code, body)` to preserve status-specific body types.

```ts
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/result', {
		response: {
			200: t.Object({ name: t.String() }),
			400: t.Object({ error: t.String() })
		}
	}, ({ query, status }) => query.fail === 'true'
		? status(400, { error: 'Invalid request' })
		: { name: 'Ada' })
```

## Standard Schema

Use compatible Standard Schema validators in any schema slot, alone or mixed with TypeBox on one route. Use each library's coercion and type helpers; Elysia's TypeBox coercion does not apply to other validators.

```ts
import { Elysia } from 'elysia'
import { z } from 'zod'

new Elysia()
	.get('/users/:id', {
		params: z.object({ id: z.coerce.number() })
	}, ({ params }) => params.id)
```

For example, use `z.infer<typeof schema>`, Valibot's `InferOutput`, or ArkType's `typeof schema.infer`.

## Files

`t.File` options include `type`, `minSize`, and `maxSize`. `t.Files` also accepts `minItems` and `maxItems`. Sizes are bytes or strings suffixed with `k` or `m`, using powers of 1,024. Media types accept a string or array, including groups such as `'image'` or `'image/*'`.

Elysia 2 does not bundle a file detector. Register one before validating `type`; otherwise type-checked uploads fail validation.

```ts
import { Elysia, t, setFileTypeDetector } from 'elysia'
import { fileTypeFromBlob } from 'file-type'

setFileTypeDetector(fileTypeFromBlob)

new Elysia()
	.post('/upload', {
		body: t.Object({
			file: t.File({ type: ['image/png', 'image/jpeg'], maxSize: '5m' })
		})
	}, ({ body }) => ({ name: body.file.name }))
```

For Standard Schema uploads, set `parse: 'formdata'` and validate file content with Elysia's async `fileType()` helper. `file.type` alone is client-supplied metadata. This example includes detector setup:

```ts
import { Elysia, fileType, setFileTypeDetector } from 'elysia'
import { fileTypeFromBlob } from 'file-type'
import { z } from 'zod'

setFileTypeDetector(fileTypeFromBlob)

new Elysia()
	.post('/upload', {
		parse: 'formdata',
		body: z.object({
			file: z.file().refine((file) => fileType(file, 'image/jpeg'), 'Expected JPEG')
		})
	}, ({ body }) => ({ name: body.file.name }))
```

For raw binary uploads, pair `parse: 'arrayBuffer'` with `body: t.Uint8Array()` or `body: t.ArrayBuffer()`.

## Shared schemas and guards

A route schema replaces the inherited guard schema for the same slot by default; object fields do not merge. `schema: 'merge'` accumulates constraints so both schemas must pass. Guard scope and examples belong in [composition.md](composition.md).

## Models and types

Share schema variables directly. Register them with `.model()` for string references or named OpenAPI components, before the routes that use them.

```ts
import { Elysia, t, type UnwrapSchema, type UnwrapModels } from 'elysia'

const User = t.Object({ id: t.String(), name: t.String() })
type User = UnwrapSchema<typeof User>

const ByIdGet = { Params: t.Object({ id: t.String() }), Response: User }
type ByIdGet = UnwrapModels<typeof ByIdGet>

new Elysia()
	.model({ 'user.profile': User })
	.post('/profile', { body: 'user.profile', response: 'user.profile' }, ({ body }) => body)
```

`ByIdGet.Params` is the schema; `ByIdGet['Params']` is its TypeScript type. See [project structure](project-structure.md) for a feature model convention.

## Type performance

For slow inference, run `tsc --generateTrace trace --noEmit --incremental false` and inspect `trace/trace.json` in Perfetto. If [Eden](eden.md) needs only a sub-app, export that sub-app's type and preserve its URL prefix in the client.
