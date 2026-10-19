# Cookies

`context.cookie` is a reactive jar. Access returns a `Cookie` object even for absent cookies, so check `.value`. Iteration visits existing names. Object values serialize and decode automatically. In Elysia 2, wrap each field in `t.Cookie` inside `t.Object` to give each cookie its own schema and attributes.

## Read and write

```ts
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/profile', {
		cookie: t.Object({
			profile: t.Cookie(
				t.Optional(t.Object({ id: t.Number(), name: t.String() })),
				{ httpOnly: true, sameSite: 'lax', path: '/' }
			),
			theme: t.Cookie(t.Optional(t.String()), { sameSite: 'lax', path: '/' })
		})
	}, ({ cookie: { profile, theme } }) => {
		profile.value = { id: 1, name: 'Ada' }
		theme.value = 'dark'
		return { profile: profile.value, theme: theme.value }
	})
```

Required cookie schemas reject missing cookies. Use `t.Optional` to allow creation on the first request. `t.Nullable` allows `null`, not absence. Per-field `t.Cookie` options let cookies use different attributes. Undeclared names are allowed by default.

Changing `.value` or an attribute schedules `Set-Cookie` automatically. Attributes such as `httpOnly` describe outgoing cookies; an incoming `Cookie` header cannot prove those attributes.

| Operation | Behavior |
| --- | --- |
| `cookie.name.value` | Reads the decoded value |
| `cookie.name.value = value` | Sets the outgoing value |
| `cookie.name.httpOnly = true` | Changes one attribute |
| `cookie.name.update(options)` | Merges options into current properties |
| `cookie.name.set(options)` | Rebuilds from initial properties and current value, then applies options |
| `cookie.name.remove()` | Expires the cookie; no-op when its value is `undefined` |

`delete cookie.name` does not expire a browser cookie. Removal must use the original path and domain. Keep these in constructor or route cookie configuration; `remove()` uses `set()` and resets later attribute changes to the initial defaults.

## Signing and rotation

Configure signing in the constructor's `cookie` option or the second argument of `t.Cookie`. `sign` selects names; `true` selects all. Signing detects tampering but does not encrypt values.

This example requires `COOKIE_SECRET` in the environment:

```ts
import { Elysia, t } from 'elysia'

const secret = process.env.COOKIE_SECRET
if (!secret) throw new Error('COOKIE_SECRET is required')

new Elysia({
	cookie: { secrets: secret }
})
	.get('/session', {
		cookie: t.Object({
			session: t.Cookie(t.Optional(t.String()), {
				sign: true,
				httpOnly: true,
				path: '/'
			})
		})
	}, ({ cookie: { session } }) => {
		session.value = crypto.randomUUID()
		return 'Session created'
	})
```

For rotation, use `secrets: [currentSecret, previousSecret]`. Verification tries the keys; signing always uses the first entry, which must be a nonempty string. A trailing `null` allows unsigned cookies during a migration while still rejecting invalid signatures. Remove it when the transition ends. `null` is not a signing key.

Invalid signatures raise `InvalidCookie` with status 400. Missing signing secrets cause a server error. See [errors.md](errors.md).

## Configuration

Set cookie defaults in the constructor or `t.Cookie`. `set()` and `update()` accept values and attributes, not signing configuration. Passing `secrets` there throws.

| Option | Values or unit | Notes |
| --- | --- | --- |
| `secrets` | String or array of strings and optional `null` | Plural spelling; rotation described above |
| `sign` | `true`, name, or array of names | Selects signed cookies |
| `path` | String | Elysia defaults to `'/'` |
| `domain` | String | Omit for the current host |
| `expires` | Date | Absolute expiration |
| `maxAge` | Seconds | Floored to an integer; align with `expires` if setting both |
| `httpOnly` | Boolean | Hides the cookie from `document.cookie` |
| `secure` | Boolean | Sends the cookie over HTTPS only |
| `sameSite` | `'lax'`, `'strict'`, `'none'`, boolean | `true` means Strict; `false` omits the attribute |
| `priority` | `'low'`, `'medium'`, `'high'` | Browser-dependent |
| `partitioned` | Boolean | Partitioned cookie attribute |

There is no custom `encode` option in v2. Assign values through `.value`.

For cross-origin browser requests, use `fetch(url, { credentials: 'include' })` and matching [CORS configuration](plugins.md). Browser cookie policies still apply.
