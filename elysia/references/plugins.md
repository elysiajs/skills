# ElysiaJS Plugins

## CORS Plugin

### Installation
```bash
bun add @elysiajs/cors
```

### Basic Usage
```typescript
import { cors } from '@elysiajs/cors'

new Elysia()
  .use(cors())  // Allow all origins
```

### Custom Configuration
```typescript
.use(cors({
  origin: 'localhost:3000',              // Single origin
  // OR
  origin: ['localhost:3000', 'app.com'], // Multiple origins
  // OR
  origin: /\.example\.com$/,             // Regex pattern
  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Custom-Header'],
  maxAge: 3600
}))
```

## Static Plugin

### Installation
```bash
bun add @elysiajs/static
```

### Basic Usage (public folder)
```typescript
import { staticPlugin } from '@elysiajs/static'

new Elysia()
  .use(staticPlugin())
  // Files in ./public are served at /public/*
```

### Custom Configuration
```typescript
.use(staticPlugin({
  assets: 'public',      // Folder to serve
  prefix: '/',           // URL prefix (default: '/public')
  alwaysStatic: true,    // Always serve static files first
  ignorePatterns: ['.git', 'node_modules']
}))
```

### Multiple Static Folders
```typescript
.use(staticPlugin({ assets: 'public', prefix: '/' }))
.use(staticPlugin({ assets: 'images', prefix: '/img' }))
```

## OpenAPI Plugin

### Installation
```bash
bun add @elysiajs/openapi
```

### Basic Usage
```typescript
import { openapi } from '@elysiajs/openapi'

new Elysia()
  .use(openapi())
  .get('/user/:id', ({ params: { id } }) => ({ id }), {
    params: t.Object({
      id: t.Number()
    }),
    detail: {
      summary: 'Get user by ID',
      tags: ['user']
    }
  })
```

### Custom Configuration
```typescript
.use(openapi({
  documentation: {
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API documentation'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local' },
      { url: 'https://api.example.com', description: 'Production' }
    ],
    tags: [
      { name: 'user', description: 'User operations' },
      { name: 'auth', description: 'Authentication' }
    ]
  },
  path: '/docs',           // Documentation endpoint
  exclude: ['/internal/*'] // Exclude routes from docs
}))
```

### Route Details
```typescript
.get('/user/:id', handler, {
  detail: {
    summary: 'Get user',
    description: 'Retrieve user by ID',
    tags: ['user'],
    deprecated: false,
    operationId: 'getUser'
  }
})
```

## JWT Plugin

### Installation
```bash
bun add @elysiajs/jwt
```

### Basic Usage
```typescript
import { jwt } from '@elysiajs/jwt'

new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET!
  }))
  .post('/sign', async ({ jwt, body }) => {
    return await jwt.sign({ userId: body.id })
  })
  .get('/verify', async ({ jwt, headers, status }) => {
    const token = headers.authorization?.replace('Bearer ', '')
    const payload = await jwt.verify(token)
    
    if (!payload) return status(401, 'Invalid token')
    
    return payload
  })
```

### With Cookies
```typescript
.use(jwt({
  name: 'jwt',
  secret: process.env.JWT_SECRET!
}))
.post('/login', async ({ jwt, body, cookie: { auth } }) => {
  const token = await jwt.sign({ userId: body.id })
  
  auth.set({
    value: token,
    httpOnly: true,
    maxAge: 7 * 86400,  // 7 days
    path: '/'
  })
  
  return { success: true }
})
.get('/profile', async ({ jwt, cookie: { auth }, status }) => {
  const payload = await jwt.verify(auth.value)
  
  if (!payload) return status(401)
  
  return { userId: payload.userId }
})
```

## HTML Plugin

### Installation
```bash
bun add @elysiajs/html
```

### Basic Usage
```typescript
import { html } from '@elysiajs/html'

new Elysia()
  .use(html())
  .get('/', () => '<h1>Hello World</h1>')
  .get('/jsx', () => (
    <html>
      <body>
        <h1>Hello JSX</h1>
      </body>
    </html>
  ))
```

### TSConfig for JSX
```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "Html.createElement",
    "jsxFragmentFactory": "Html.Fragment"
  }
}
```

## Custom Plugin Pattern

```typescript
const myPlugin = new Elysia({ name: 'my-plugin' })
  .decorate('customProp', 'value')
  .get('/plugin-route', () => 'Hello from plugin')

new Elysia()
  .use(myPlugin)
  .get('/', ({ customProp }) => customProp)
```

## Plugin Deduplication

Elysia prevents duplicate plugin execution using `name` and optional `seed`:

```typescript
// Plugin definition
const myPlugin = new Elysia({ 
  name: 'my-plugin',
  seed: { version: '1.0.0' }  // Optional
})
  .get('/plugin-route', () => 'Hello')

// Main app
new Elysia()
  .use(myPlugin)
  .use(myPlugin)  // Won't execute twice - same name & seed
  .use(myPlugin)  // Still won't execute
```

**How it works:**
- Plugins with same `name` + `seed` execute only once
- Without `seed`, only `name` is used for deduplication
- Useful for shared plugins across multiple modules

**Example: Database Plugin**
```typescript
// db-plugin.ts
export const dbPlugin = new Elysia({ 
  name: 'db',
  seed: db  // Use db instance as seed
})
  .decorate('db', db)

// user-module.ts
import { dbPlugin } from './db-plugin'

export const userModule = new Elysia()
  .use(dbPlugin)  // First use
  .get('/users', ({ db }) => db.getUsers())

// auth-module.ts
import { dbPlugin } from './db-plugin'

export const authModule = new Elysia()
  .use(dbPlugin)  // Won't re-register
  .get('/login', ({ db }) => db.validateUser())

// main.ts
import { userModule } from './user-module'
import { authModule } from './auth-module'

new Elysia()
  .use(userModule)  // dbPlugin executes
  .use(authModule)  // dbPlugin skipped (already registered)
```

## Plugin Scoping & Lifecycle

### Scope Types

**local** (default) - Hooks apply only to current instance:
```typescript
const plugin = new Elysia()
  .onBeforeHandle(() => console.log('Local hook'))
  // No .as() = local by default

new Elysia()
  .use(plugin)
  .get('/a', () => 'A')  // Has hook
  .get('/b', () => 'B')  // Has hook

new Elysia()
  .get('/c', () => 'C')  // No hook (different instance)
```

**scoped** - Hooks apply to parent and descendants:
```typescript
const plugin = new Elysia()
  .onBeforeHandle(() => console.log('Scoped hook'))
  .as('scoped')

const child = new Elysia()
  .use(plugin)
  .get('/child', () => 'Child')  // Has hook

new Elysia()
  .use(child)
  .get('/parent', () => 'Parent')  // Has hook (inherited from child)
```

**global** - Hooks apply to all instances:
```typescript
const plugin = new Elysia()
  .onBeforeHandle(() => console.log('Global hook'))
  .as('global')

new Elysia()
  .use(plugin)
  .get('/a', () => 'A')  // Has hook

new Elysia()
  .get('/b', () => 'B')  // Has hook (global applies everywhere)
```

### Scope Inheritance Example

```typescript
// Auth plugin - scoped to parent
const authPlugin = new Elysia({ name: 'auth' })
  .onBeforeHandle(({ headers, status }) => {
    if (!headers.authorization) return status(401)
  })
  .as('scoped')

// User module
const userModule = new Elysia()
  .use(authPlugin)  // Auth applies to this module
  .get('/profile', () => 'Profile')
  .get('/settings', () => 'Settings')

// Public module (no auth)
const publicModule = new Elysia()
  .get('/about', () => 'About')
  .get('/contact', () => 'Contact')

// Main app
new Elysia()
  .use(userModule)    // /profile, /settings have auth
  .use(publicModule)  // /about, /contact don't have auth
```

### When to Use Each Scope

| Scope | Use Case | Example |
|-------|----------|---------|
| **local** | Plugin hooks should only affect routes in same module | Route-specific validation |
| **scoped** | Plugin hooks should affect parent using it | Auth plugin, CORS for specific API section |
| **global** | Plugin hooks should affect entire app | Logging, monitoring, global CORS |

### Scope with Guards

```typescript
// Local guard (default)
const localGuard = new Elysia()
  .guard({
    beforeHandle: checkAuth
  }, app => app
    .get('/a', () => 'A')
    .get('/b', () => 'B')
  )

// Scoped guard
const scopedGuard = new Elysia()
  .guard({
    beforeHandle: checkAuth,
    as: 'scoped'
  }, app => app
    .get('/a', () => 'A')
  )

new Elysia()
  .use(scopedGuard)
  .get('/b', () => 'B')  // Also has checkAuth
```

### Complete Example: Scoped Auth Plugin

```typescript
// plugins/auth.ts
export const authPlugin = new Elysia({ 
  name: 'auth',
  seed: 'v1' 
})
  .macro({
    auth: {
      resolve({ headers, status }) {
        const token = headers.authorization?.replace('Bearer ', '')
        if (!token) return status(401)
        
        const user = verifyToken(token)
        if (!user) return status(401)
        
        return { user }
      }
    }
  })
  .as('scoped')  // Apply to parent using this plugin

// modules/user.ts
import { authPlugin } from '../plugins/auth'

export const userModule = new Elysia({ prefix: '/user' })
  .use(authPlugin)
  .get('/profile', ({ user }) => user, { auth: true })
  .get('/settings', ({ user }) => user, { auth: true })

// modules/public.ts
export const publicModule = new Elysia({ prefix: '/public' })
  .get('/about', () => 'About')
  .get('/contact', () => 'Contact')

// index.ts
import { userModule } from './modules/user'
import { publicModule } from './modules/public'

new Elysia()
  .use(userModule)    // Auth plugin active for /user/* routes
  .use(publicModule)  // No auth for /public/* routes
  .listen(3000)
```
