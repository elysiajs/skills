# Better Auth

Mount Better Auth's Web handler and use a macro for session-protected routes. Install `better-auth`, its database driver, and any needed Elysia plugins from [versions.md](versions.md). Follow the installed Better Auth version for schema generation and migrations.

## Mount and require a session

```ts
// auth.ts
import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

export const auth = betterAuth({
	database: new Pool(),
	basePath: '/api/auth'
})
```

```ts
// index.ts
import { Elysia } from 'elysia'
import { cors } from '@elysia/cors'
import { auth } from './auth'

const authentication = new Elysia({ name: 'authentication' })
	.mount(auth.handler)
	.macro({
		auth: {
			async derive({ status, request: { headers } }) {
				const session = await auth.api.getSession({ headers })
				if (!session) return status(401, 'Unauthorized')
				return { user: session.user, session: session.session }
			}
		}
	})

export const app = new Elysia()
	.use(cors({
		origin: 'http://localhost:3001',
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization']
	}))
	.use(authentication)
	.get('/user', { auth: true }, ({ user }) => user)
```

Auth endpoints use `/api/auth`. Routes with `auth: true` receive `user` and `session`; unauthenticated requests return 401. See [composition](composition.md) for macros and mounts.

For browser sessions, configure Better Auth's trusted origins and cookie settings. CORS alone is insufficient. The browser client must include credentials.

A mount prefix changes the public URL. For example, `.mount('/auth', auth.handler)` with `basePath: '/api'` exposes `/auth/api`. Keep the client base URL, mount, and OpenAPI path prefix consistent.

## Merge OpenAPI paths

Add `openAPI()` from `better-auth/plugins` to the `auth.ts` configuration. This exposes `auth.api.generateOpenAPISchema()`.

```ts
import { betterAuth } from 'better-auth'
import { openAPI } from 'better-auth/plugins'
import { Pool } from 'pg'

export const auth = betterAuth({
	database: new Pool(),
	basePath: '/api/auth',
	plugins: [openAPI()]
})
```

Generate the schema once at startup. This prefix matches `.mount(auth.handler)` above.

```ts
import { Elysia } from 'elysia'
import { openapi } from '@elysia/openapi'
import { auth } from './auth'

const schema = await auth.api.generateOpenAPISchema()
const paths = Object.fromEntries(
	Object.entries(schema.paths).map(([path, operation]) => [
		`/api/auth${path}`,
		operation
	])
)

export const app = new Elysia()
	.mount(auth.handler)
	.use(openapi({
		documentation: { components: schema.components, paths }
	}))
```

To combine this with the session example, add `openapi(...)` to that app. See [OpenAPI](openapi.md).
