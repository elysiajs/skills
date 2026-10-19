# Plugins

Match plugin peer dependencies to the app's Elysia version. See [versions.md](versions.md) for pins and compatibility. Package names alone do not distinguish v1 from v2.

Contents: [package selection](#package-selection), [CORS](#cors), [bearer and JWT](#bearer-and-jwt), [static files](#static-files), [HTML](#html), [cron](#cron), [GraphQL](#graphql).

## Package selection

| Need | Package and export | Details |
| --- | --- | --- |
| Cross-origin requests | `@elysia/cors`, `cors` | [CORS](#cors) |
| Extract bearer tokens | `@elysia/bearer`, `bearer` | [Bearer and JWT](#bearer-and-jwt) |
| Sign and verify JWTs | `@elysia/jwt`, `jwt` | [Bearer and JWT](#bearer-and-jwt) |
| Static directories | `@elysia/static`, `staticPlugin` | [Static files](#static-files) |
| HTML and Kita JSX | `@elysia/html`, `html`, `Html` | [HTML](#html) |
| In-process jobs | `@elysia/cron`, `cron`, `Patterns` | [Cron](#cron) |
| Apollo GraphQL | `@elysia/apollo`, `apollo`, `gql` | [GraphQL](#graphql) |
| GraphQL Yoga | `@elysia/graphql-yoga`, `yoga` | [GraphQL](#graphql) |
| API documentation | `@elysia/openapi`, `openapi`, `fromTypes`, `withHeaders` | [OpenAPI](openapi.md) |
| Traces and browser timings | `@elysia/opentelemetry`, `@elysia/server-timing` | [Observability](observability.md) |
| Node server | `@elysia/node`, `node` | [Runtimes](runtimes.md) |
| Typed frontend client | `@elysia/eden`, `treaty`, `edenFetch` | [Eden](eden.md) |

`@elysia/swagger` is the older integration. Prefer `@elysia/openapi` for v2. Check community packages' peer ranges, runtime dependencies, and a working example. Directory listings do not prove v2 compatibility.

## CORS

```ts
import { Elysia } from 'elysia'
import { cors } from '@elysia/cors'

export const app = new Elysia()
	.use(cors({
		origin: 'https://app.example.com',
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization']
	}))
	.get('/', () => 'Hello')
```

`cors()` accepts any origin by default. For credentialed browser requests, set the frontend origin and client `credentials: 'include'`.

| Option | Default and behavior |
| --- | --- |
| `origin` | `true` reflects `Origin`; string, RegExp, request predicate, or an array restricts origins; `false` omits the header |
| `methods` | `true` reflects the requested preflight method; use a string or array to restrict methods |
| `allowedHeaders` | `true` reflects requested preflight headers; use a string or array to restrict them |
| `exposeHeaders` | Use an explicit string or array for response headers the browser may read |
| `credentials` | `true` |
| `maxAge` | `5` seconds |
| `preflight` | Enables handling of `OPTIONS` preflight requests |

An origin predicate receives the `Request`. Anchor origin regexes, such as `/^https:\/\/(?:[a-z0-9-]+\.)*example\.com$/i`, so an unrelated hostname cannot match a substring.

## Bearer and JWT

`bearer()` extracts a token; it does not authenticate the caller. `jwt.verify()` returns the verified payload or `false`.

```ts
import { Elysia } from 'elysia'
import { bearer } from '@elysia/bearer'
import { jwt } from '@elysia/jwt'

const secret = process.env.JWT_SECRET
if (!secret) throw new Error('JWT_SECRET is required')

export const app = new Elysia()
	.use(bearer())
	.use(jwt({ name: 'jwt', secret, exp: '7d' }))
	.get('/profile', async ({ bearer, jwt, status }) => {
		const profile = await jwt.verify(bearer)
		if (!profile) return status(401, 'Unauthorized')
		return profile
	})
```

Call `await jwt.sign(payload)` only after the application's credential check. `name` chooses the helper's context property; use distinct names for different configurations. `schema` validates and types custom payload fields. Common configuration includes `alg`, `iss`, `aud`, `sub`, `exp`, `nbf`, and `iat`; additional protected-header options follow jose.

For cookie transport, use the same verification flow with the cookie value. Set `httpOnly`, `secure` for HTTPS, `sameSite`, `path`, and the cookie lifetime explicitly. JWT expiry and cookie expiry are separate. See [cookies](cookie.md).

## Static files

```ts
import { Elysia } from 'elysia'
import { staticPlugin } from '@elysia/static'

new Elysia().use(staticPlugin({ assets: 'public', prefix: '/public' }))
```

| Option | Default and behavior |
| --- | --- |
| `assets` | `public` directory |
| `prefix` | `/public` URL prefix |
| `ignorePatterns` | `[]` |
| `headers` | `{}` response headers |
| `staticLimit` | `1024` paths before switching to lazy registration |
| `alwaysStatic` | `NODE_ENV === 'production'`; ignores `staticLimit` when true |
| `indexHTML` | `true`; serves directory `index.html`, not a fallback for every missing SPA path |

For one file, use Elysia's `file` helper:

```ts
import { Elysia, file } from 'elysia'

new Elysia().get('/logo', file('public/logo.png'))
```

## HTML

`html()` sets the HTML content type and can detect HTML strings. Its JSX uses `@kitajs/html` to return strings, unlike React JSX.

```tsx
import { Elysia, t } from 'elysia'
import { html, Html } from '@elysia/html'

new Elysia()
	.use(html())
	.post('/greet', { body: t.Object({ name: t.String() }) }, ({ body }) => (
		<html><body><h1 safe>{body.name}</h1></body></html>
	))
```

Use `.tsx` and configure the factory:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "Html.createElement",
    "jsxFragmentFactory": "Html.Fragment"
  }
}
```

Import uppercase `Html` in JSX files. Use `safe` for untrusted text. The optional `@kitajs/ts-html-plugin` editor plugin can flag unsafe JSX expressions.

| Option | Default and behavior |
| --- | --- |
| `contentType` | `text/html; charset=utf8` |
| `autoDetect` | `true` |
| `autoDoctype` | `true`; adds a doctype to an HTML root if absent; `'full'` currently behaves like `true` |
| `isHtml` | Detection function; the current automatic-response path still calls the built-in detector |

Use context `html(value)` for explicit HTML responses. Verify the installed implementation before relying on custom `isHtml` detection.

## Cron

```ts
import { Elysia } from 'elysia'
import { cron, Patterns } from '@elysia/cron'

new Elysia().use(cron({
	name: 'heartbeat',
	pattern: Patterns.everyMinutes(5),
	run() { console.log('heartbeat') }
}))
```

The job is available at `store.cron.heartbeat`, including `.stop()`. `pattern` accepts cron syntax with an optional leading seconds field. `timezone`, `startAt`, `stopAt`, `maxRuns`, `catch`, and `interval` pass through to Croner.

Useful helpers include `everySeconds(n)`, `everyMinutes(n)`, `everyHours(n)`, `everyHoursAt(hour, minute)`, `everyDayAt('04:00')`, and `everyWeekOn(Patterns.MONDAY, '09:00')`. These jobs run inside each app process; multiple replicas create multiple job instances.

## GraphQL

Apollo requires its matching `graphql` and `@apollo/server` dependencies. Context uses Elysia's Web `request`, not Express `req` and `res`.

```ts
import { Elysia } from 'elysia'
import { apollo, gql } from '@elysia/apollo'

new Elysia().use(apollo({
	typeDefs: gql`type Query { hello: String }`,
	resolvers: { Query: { hello: () => 'Hello' } },
	context: async ({ request }) => ({
		authorization: request.headers.get('Authorization')
	})
}))
```

`path` defaults to `/graphql`. `enablePlayground` controls the UI; set it explicitly for the deployment. Other options follow the installed Apollo server version.

Yoga infers resolver types from `typeDefs` through Mobius:

```ts
import { Elysia } from 'elysia'
import { yoga } from '@elysia/graphql-yoga'

new Elysia().use(yoga({
	typeDefs: `type Query { hello: String }`,
	context: { name: 'Alex' },
	useContext(_) {},
	resolvers: { Query: { hello: (_parent, _args, context) => context.name } }
}))
```

The empty `useContext` hook preserves context inference in the documented integration. `path` defaults to `/graphql`; remaining options follow Yoga, with schema configuration at the root. Match `graphql` and `graphql-yoga` to the plugin's declared dependencies.
