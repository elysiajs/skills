# Errors

Return expected failures for TypeScript, [Eden](eden.md), and [OpenAPI type generation](openapi.md) to infer them. Thrown failures reach error hooks but are absent from the inferred route return type.

Contents: [response choice](#response-choice), [hooks](#error-hooks), [custom errors](#custom-errors), [production](#production-behavior), [validation](#validation-errors).

## Response choice

| Result | Runtime behavior |
| --- | --- |
| `return status(code, body)` | Ordinary response with status-specific typing |
| `return problem(code, fields)` | Ordinary RFC 9457 response with `application/problem+json` |
| Return or throw an `Error` | Enters error hooks, then the default error response if unhandled |
| Throw `status()` or `problem()` | Enters error hooks |

A returned `Error` from `afterHandle` also enters error handling. For an authentication rejection, return `status(401, 'Unauthorized')`; `new Error('Unauthorized')` has status 500.

Return expected errors as values from helpers and services. At each caller, use `if (thing instanceof Error) return thing` to propagate the error up to the route handler. TypeScript narrows the remaining value to the success type and keeps the returned error in the function's return union.

```ts
import { Elysia, problem } from 'elysia'

type User = { id: string; name: string }
class UserLookupFailed extends Error {}

declare function findUser(id: string): Promise<User | UserLookupFailed>

new Elysia()
	.onError(UserLookupFailed, problem(503, { detail: 'User lookup failed' }))
	.get('/users/:id', async ({ params }) => {
		const user = await findUser(params.id)
		if (user instanceof Error) return user
		return { id: user.id, name: user.name }
	})
```

Keep the concrete error classes in each return union, either through inference or an explicit annotation such as `User | UserLookupFailed`. Returning the error through every layer lets Elysia include its mapped response in Eden and OpenAPI types. Throw or rethrow unexpected errors so error hooks can handle them.

```ts
import { Elysia, problem } from 'elysia'

new Elysia()
	.get('/conflict', () => problem(409, { detail: 'Username is taken' }))
```

`problem()` fills `type`, `title`, and `status`. Both helpers accept numeric statuses or names such as `'Conflict'`. Assigning `set.status` changes the runtime status without preserving the status/body relationship in inference.

## Error hooks

| Form | Matches |
| --- | --- |
| `.onError(fn)` | Errors for following routes on the instance |
| `.onError(ErrorClass, fn)` | Errors of that class |
| `.onError(ErrorClass, value)` | Same, with a constant response |
| Route option `error` | Errors on that route |

Hooks receive `error`, `status`, and the context available at failure. Narrow with `instanceof`.

- Return a response to handle the error.
- Return `undefined` to continue to the next hook and eventually the default response.
- Return another `Error` to send its default response at its own status. That returned error does not run through the remaining hooks.

```ts
import { Elysia, NotFound, problem } from 'elysia'

class DatabaseUnavailable extends Error {}

new Elysia()
	.onError(NotFound, ({ status }) => status(404, 'Not found'))
	.onError(DatabaseUnavailable, problem(503, { detail: 'Please try again later' }))
	.get('/users', () => new DatabaseUnavailable())
```

Returning the mapped class adds the mapped response to the route type. For library errors, catch and return expected failures; rethrow unknown ones. See [composition.md](composition.md) for hook scope.

## Custom errors

`HTTPError.id(code, status?)` creates a problem-response class without hook registration. It gives clients a stable `code`; `type` initially matches it.

```ts
import { Elysia, HTTPError } from 'elysia'

class OutOfCredit extends HTTPError.id('OUT_OF_CREDIT', 402) {
	readonly detail = 'Top up to continue'

	constructor(readonly balance: number) {
		super()
	}

	extension() {
		return { balance: this.balance }
	}
}

new Elysia().get('/credit', () => new OutOfCredit(30))
```

This sends status 402 with `type`, `code`, `title`, `status`, `detail`, and `balance`. Eden can narrow `error.value` by `error.status`.

### Response customization

| Member | Effect |
| --- | --- |
| `headers` | Response headers |
| `detail` | Public problem detail, instead of the error message |
| `extension()` | Synchronous plain object added to the problem document |
| `value()` | Entire response body; may be async or return `status()`/`problem()` |

Precedence is `value()`, then `detail`, then the extension's string `detail`, then the message fallback. A `value()` returning `undefined` falls through. Any other value skips `extension()`.

`extension()` cannot override `type`, `code`, or `status`. It may override `title` and `instance`. Function-valued members and non-plain results, including Promises, are ignored. If `value()` or `extension()` throws, the response becomes 500 without that error's headers.

For a variable status, omit the status in `HTTPError.id()` and return a typed `status()` or `problem()` from `value()`. For a response that needs request context, use `.onError(Class, handler)`.

### Hand-written classes and type URLs

A class can extend `HTTPError` with literal `type` and `status` fields. A class extending `Error` can implement the `HTTPError` interface, but its production 5xx handling differs; see below. Keep discriminants `readonly` or `as const` for static narrowing. Without a status, the default is 500.

`HTTPError.id()` supplies `code` and applies `HTTPError.typeBase` to `type`. Hand-written classes send their `type` as written. For example, `HTTPError.typeBase = 'https://example.com/errors'` makes the example's type `https://example.com/errors/OUT_OF_CREDIT`, while `code` remains `OUT_OF_CREDIT`.

## Production behavior

Redaction under `NODE_ENV=production` depends on the error path. It is not a blanket removal of messages or `detail`.

| Error path | Production response |
| --- | --- |
| Unhandled `Error` without a status | 500 problem document without the development `detail` and `name` |
| Plain `Error` with a status | Message fallback for 5xx is masked; ordinary 4xx messages remain visible |
| `HTTPError` subclass with only a constructor message | 5xx message fallback is replaced by the status title |
| `HTTPError` subclass with explicit `detail`, `extension()`, or `value()` | Authored response data remains public, including on 5xx |
| `Error implements HTTPError` with a 5xx status | Masked problem document; custom response methods and headers are not honored as they are for subclasses |
| `new NotFound(message)` or `new InternalServerError(message)` | Explicit message remains public as `detail` |
| Custom response from `onError`, `status()`, or `problem()` | Authored response remains public |

Explicit error bodies are public API data. Default redaction does not sanitize them.

## Validation errors

Request validation failures return 422. Response validation failures return 500. The default request problem document includes `type: 'validation'`, `code: 'validation'`, `on` for the failing slot, and `property` for the field or `root`.

Set `error` on a schema to customize its failure response:

```ts
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/:id', {
		params: t.Object({ id: t.Number({ error: 'id must be a number' }) })
	}, ({ params }) => params.id)
```

A message applies to the schema it is attached to. A field message handles that field's failure; an object's own message handles failure of the object itself. An error callback receives `type: 'validation'`, `on`, and development-only `value` and `errors`.

`validationDetail(message)`, imported from `elysia`, adds validation detail around a message. Default production responses omit submitted data and issues. Custom messages remain public as written, including strings and objects. `allowUnsafeValidationDetails: true` on the Elysia constructor exposes validation detail in production; use it only for data intended to be public. Default production response-validation failures are bare internal server errors.

`ValidationError.all` is an array property, not a method. Each normalized issue has `path`, `message`, `schemaPath`, and `params`. Paths use dotted notation such as `user.email`. `error.errors` contains provider-specific issues, such as TypeBox's `/user/email` `instancePath`. Production redaction can reduce available issues.

## Built-in errors

Import these classes from `elysia` for class-specific hooks.

| Class | Status | Code | Cause |
| --- | --- | --- | --- |
| `NotFound` | 404 | `not-found` | No matching route |
| `ParseError` | 400 | `parse` | Malformed body |
| `ValidationError` | 422 or 500 | `validation` | Request or response schema failure |
| `InvalidCookie` | 400 | `invalid-cookie` | Invalid cookie signature |
| `InternalServerError` | 500 | `internal-server-error` | Explicit server error |

A missing cookie secret is a server misconfiguration and returns 500. `ParseError` exposes its parser cause only in development. Built-in problem types use `HTTPError.typeBase`, except validation keeps `type: 'validation'`.
