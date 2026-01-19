---
name: elysiajs
description: Expert knowledge for building type-safe, high-performance backend servers with ElysiaJS. Covers routing, validation, authentication, plugins (CORS, OpenAPI, JWT, Static), integrations (Eden, Next.js, Drizzle, OpenTelemetry), WebSocket, testing, and deployment. Use when creating/modifying Elysia routes, setting up validation, implementing auth, adding plugins, or deploying to production.
---

# ElysiaJS Development Skill

Always consult elysiajs.com/llms.txt for code examples and latest API.

## Overview

ElysiaJS is a Bun-first TypeScript framework for building type-safe, high-performance backend servers. This skill provides comprehensive guidance for developing with Elysia, including routing, validation, authentication, plugins, integrations, and deployment.

## When to Use This Skill

Trigger this skill when the user asks to:
- Create or modify ElysiaJS routes, handlers, or servers
- Setup validation with TypeBox or other schema libraries (Zod, Valibot)
- Implement authentication (JWT, session-based, macros, guards)
- Add plugins (CORS, OpenAPI, Static files, JWT)
- Integrate with external services (Drizzle ORM, Better Auth, Next.js, Eden Treaty)
- Setup WebSocket endpoints for real-time features
- Create unit tests for Elysia instances
- Deploy Elysia servers to production

## Quick Start

### Basic Server
```typescript
import { Elysia, t } from 'elysia'

const app = new Elysia()
  .get('/', () => 'Hello World')
  .post('/user', ({ body }) => body, {
    body: t.Object({
      name: t.String(),
      age: t.Number()
    })
  })
  .listen(3000)
```

### Project Structure (Recommended)
```
src/
├── index.ts              # Main server entry
├── modules/
│   ├── auth/
│   │   ├── index.ts      # Auth routes (Elysia instance)
│   │   ├── service.ts    # Business logic
│   │   └── model.ts      # TypeBox schemas/DTOs
│   └── user/
│       ├── index.ts
│       ├── service.ts
│       └── model.ts
└── plugins/
    └── custom.ts

public/                   # Static files (if using static plugin)
test/                     # Unit tests
```

## Core Concepts

### 1. Routing & Validation

**Basic Route:**
```typescript
.get('/user/:id', ({ params: { id } }) => id)
```

**With TypeBox Validation:**
```typescript
.post('/user', ({ body }) => body, {
  body: t.Object({
    name: t.String(),
    email: t.String({ format: 'email' }),
    age: t.Number({ minimum: 0 })
  }),
  response: {
    201: t.Object({
      id: t.String(),
      name: t.String()
    })
  }
})
```

**Alternative: Zod/Valibot (Standard Schema):**
```typescript
import { z } from 'zod'

.post('/user', ({ body }) => body, {
  body: z.object({
    name: z.string(),
    email: z.string().email()
  })
})
```

### 2. Common Plugins

**CORS:**
```typescript
import { cors } from '@elysiajs/cors'

.use(cors({
  origin: 'localhost:3000',
  credentials: true
}))
```

**Static Files (public folder):**
```typescript
import { staticPlugin } from '@elysiajs/static'

.use(staticPlugin({
  prefix: '/',        // Optional: default is '/public'
  assets: 'public'    // Folder name
}))
```

**OpenAPI Documentation:**
```typescript
import { openapi } from '@elysiajs/openapi'

.use(openapi({
  documentation: {
    info: {
      title: 'My API',
      version: '1.0.0'
    }
  }
}))
```

**JWT Authentication:**
```typescript
import { jwt } from '@elysiajs/jwt'

.use(jwt({
  name: 'jwt',
  secret: process.env.JWT_SECRET!
}))
.get('/protected', async ({ jwt, headers, status }) => {
  const token = headers.authorization?.replace('Bearer ', '')
  const user = await jwt.verify(token)
  
  if (!user) return status(401)
  
  return user
})
```

### 3. Authentication Patterns

**Macro for Reusable Auth:**
```typescript
.macro({
  auth: {
    cookie: t.Object({
      session: t.String()
    }),
    beforeHandle({ cookie: { session }, status }) {
      if (!session.value) return status(401)
    }
  }
})
.get('/profile', ({ cookie }) => cookie.session.value, {
  auth: true  // Applies the auth macro
})
```

**Guard for Multiple Routes:**
```typescript
.guard({
  beforeHandle({ headers, status }) {
    if (!headers.authorization) return status(401)
  }
}, app => app
  .get('/profile', () => 'Protected')
  .get('/settings', () => 'Protected')
)
```

### 4. Integration Examples

**Eden Treaty (End-to-end Type Safety):**
```typescript
// Server
export const app = new Elysia()
  .get('/user/:id', ({ params: { id } }) => ({ id, name: 'John' }))

export type App = typeof app

// Client
import { treaty } from '@elysiajs/eden'
import type { App } from './server'

const api = treaty<App>('localhost:3000')
const { data } = await api.user({ id: '123' }).get()
```

**Next.js Integration:**
```typescript
// app/api/[[...slugs]]/route.ts
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/api' })
  .get('/', () => 'Hello from Next.js')

export const GET = app.fetch
export const POST = app.fetch
```

**Drizzle ORM:**
```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite'

const db = drizzle(/* config */)

.decorate('db', db)
.get('/users', ({ db }) => db.select().from(users))
```

**Better Auth:**
```typescript
import { betterAuth } from 'better-auth'

const auth = betterAuth({ /* config */ })

.mount('/api/auth', auth.handler)
```

**OpenTelemetry:**
```typescript
import { opentelemetry } from '@elysiajs/opentelemetry'

.use(opentelemetry({
  serviceName: 'my-service'
}))
```

### 5. WebSocket

```typescript
.ws('/chat', {
  message(ws, message) {
    ws.send(message)
  },
  body: t.String(),
  response: t.String()
})
```

### 6. Unit Testing

**Basic Test:**
```typescript
// test/auth.test.ts
import { describe, expect, it } from 'bun:test'
import { app } from '../src/modules/auth'

describe('Auth Module', () => {
  it('should return 401 for unauthenticated requests', async () => {
    const res = await app.handle(
      new Request('http://localhost/profile')
    )
    
    expect(res.status).toBe(401)
  })
})
```

**With Eden Treaty:**
```typescript
import { treaty } from '@elysiajs/eden'

const api = treaty(app)

it('should return user profile', async () => {
  const { data, error } = await api.profile.get()
  
  expect(error).toBeNull()
  expect(data).toEqual({ name: 'John' })
})
```

### 7. Deployment

**Compile to Binary:**
```bash
bun build \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --target bun \
  --outfile server \
  src/index.ts
```

**Docker:**
```dockerfile
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY ./src ./src
ENV NODE_ENV=production

RUN bun build --compile --outfile server src/index.ts

FROM gcr.io/distroless/base
WORKDIR /app
COPY --from=build /app/server server

ENV NODE_ENV=production
CMD ["./server"]
EXPOSE 3000
```

## Workflow Decision Tree

```
User Request
│
├─ "Create route/API endpoint"
│   ├─ Check if validation needed → Add schema
│   ├─ Check if auth needed → Add macro/guard
│   └─ Return response
│
├─ "Add plugin" (CORS, OpenAPI, JWT, Static)
│   └─ Import plugin → Configure → Apply with .use()
│
├─ "Setup authentication"
│   ├─ Macro pattern (reusable auth check)
│   ├─ Guard pattern (multiple routes)
│   └─ JWT plugin (token-based)
│
├─ "Integrate with external service"
│   ├─ Eden (type-safe client)
│   ├─ Next.js (API routes)
│   ├─ Drizzle (database)
│   ├─ Better Auth
│   └─ OpenTelemetry (monitoring)
│
├─ "Add WebSocket"
│   └─ Define .ws() route with message handler
│
├─ "Create unit tests"
│   └─ Use app.handle() or Eden treaty
│
└─ "Deploy to production"
    ├─ Compile to binary
    └─ Docker containerization
```

## Resources

### references/
Detailed documentation split by topic:
- `auth.md` - Authentication patterns (macros, guards)
- `deployment.md` - Production setup
- `integrations.md` - Eden, Next.js, Drizzle, OpenTelemetry
- `plugins.md` - CORS, OpenAPI, JWT, Static
- `routes.md` - Routing, validation, handlers
- `testing.md` - Unit tests with examples
- `websocket.md` - Real-time features

### assets/ (optional)
Boilerplate templates:
- `basic-server.ts` - Starter template
- `auth-server.ts` - Server with JWT auth
- `api-with-db.ts` - Server with Drizzle ORM

## Common Patterns Quick Reference

| Task | Code |
|------|------|
| Basic route | `.get('/', () => 'Hello')` |
| Path params | `.get('/user/:id', ({ params }) => params.id)` |
| Validation | `body: t.Object({ name: t.String() })` |
| CORS | `.use(cors({ origin: 'localhost:3000' }))` |
| Static files | `.use(staticPlugin())` |
| OpenAPI | `.use(openapi())` |
| JWT | `.use(jwt({ secret: '...' }))` |
| Auth macro | See Authentication Patterns section |
| WebSocket | `.ws('/path', { message(ws, msg) {} })` |
| Unit test | `app.handle(new Request('...'))` |
