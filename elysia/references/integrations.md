# External Integrations

## Eden Treaty (End-to-end Type Safety)

### Server Setup
```typescript
// server.ts
import { Elysia, t } from 'elysia'

export const app = new Elysia()
  .get('/user/:id', ({ params: { id } }) => ({
    id,
    name: 'John Doe',
    email: 'john@example.com'
  }), {
    params: t.Object({
      id: t.Number()
    })
  })
  .post('/user', ({ body }) => body, {
    body: t.Object({
      name: t.String(),
      email: t.String({ format: 'email' })
    })
  })

export type App = typeof app  // Export type
```

### Client Usage
```typescript
// client.ts
import { treaty } from '@elysiajs/eden'
import type { App } from './server'

const api = treaty<App>('http://localhost:3000')

// Fully typed!
const { data, error } = await api.user({ id: 123 }).get()

if (error) {
  console.error(error.value)
} else {
  console.log(data.name)  // Type: string
}

// POST request
const { data: newUser } = await api.user.post({
  name: 'Jane Doe',
  email: 'jane@example.com'
})
```

### WebSocket with Eden
```typescript
// Server
.ws('/chat', {
  message(ws, message) {
    ws.send(message)
  }
})

// Client
const chat = api.chat.subscribe()
chat.subscribe((message) => {
  console.log('Received:', message)
})
chat.send('Hello!')
```

## Next.js Integration

### Setup
```typescript
// app/api/[[...slugs]]/route.ts
import { Elysia, t } from 'elysia'

const app = new Elysia({ prefix: '/api' })
  .get('/', () => 'Hello from Next.js')
  .get('/user/:id', ({ params: { id } }) => ({ id }))
  .post('/user', ({ body }) => body, {
    body: t.Object({
      name: t.String()
    })
  })

export const GET = app.fetch
export const POST = app.fetch
```

### Eden with Next.js
```typescript
// lib/api.ts
import { treaty } from '@elysiajs/eden'
import type { app } from '@/app/api/[[...slugs]]/route'

export const api = treaty<typeof app>('http://localhost:3000')

// Use in components
const { data } = await api.api.user({ id: '123' }).get()
```

## Drizzle ORM Integration

### Setup
```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { users } from './schema'

const db = drizzle(/* config */)

new Elysia()
  .decorate('db', db)
  .get('/users', ({ db }) => {
    return db.select().from(users)
  })
  .post('/user', ({ db, body }) => {
    return db.insert(users).values(body)
  }, {
    body: t.Object({
      name: t.String(),
      email: t.String()
    })
  })
```

### With Model Conversion
```typescript
import { createInsertSchema } from 'drizzle-typebox'

const insertUserSchema = createInsertSchema(users)

.post('/user', ({ db, body }) => {
  return db.insert(users).values(body)
}, {
  body: insertUserSchema
})
```

### As Plugin
```typescript
// db.ts
import { Elysia } from 'elysia'
import { drizzle } from 'drizzle-orm/bun-sqlite'

export const db = new Elysia({ name: 'db' })
  .decorate('db', drizzle(/* config */))

// server.ts
import { db } from './db'

new Elysia()
  .use(db)
  .get('/users', ({ db }) => db.select().from(users))
```

## Better Auth Integration

### Setup
```typescript
import { betterAuth } from 'better-auth'
import { Elysia } from 'elysia'

const auth = betterAuth({
  database: new Pool(),
  // ... config
})

const app = new Elysia()
  .mount('/api/auth', auth.handler)
  .listen(3000)
```

### With Macro
```typescript
.macro({
  auth: {
    async resolve({ headers, status }) {
      const session = await auth.api.getSession({ headers })
      
      if (!session) return status(401)
      
      return {
        user: session.user,
        session: session.session
      }
    }
  }
})
.get('/profile', ({ user }) => user, {
  auth: true
})
```

## OpenTelemetry Integration

### Installation
```bash
bun add @elysiajs/opentelemetry @opentelemetry/sdk-node
```

### Basic Setup
```typescript
import { opentelemetry } from '@elysiajs/opentelemetry'

new Elysia()
  .use(opentelemetry({
    serviceName: 'my-service',
    endpoint: 'http://localhost:4318'
  }))
  .get('/', () => 'Hello')
```

### With Custom Instrumentation
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces'
  }),
  instrumentations: [getNodeAutoInstrumentations()]
})

sdk.start()

new Elysia()
  .use(opentelemetry({
    serviceName: 'my-service'
  }))
  .get('/', () => 'Hello')
```

### PostgreSQL Instrumentation
```typescript
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    getNodeAutoInstrumentations(),
    new PgInstrumentation()
  ]
})
```

## Cloudflare Workers

### Setup
```typescript
import { Elysia } from 'elysia'
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker'

export default new Elysia({
  adapter: CloudflareAdapter
})
  .get('/', () => 'Hello Cloudflare!')
  .compile()
```

### With Bindings
```typescript
import { env } from 'cloudflare:workers'

.get('/data', async () => {
  const value = await env.KV.get('my-key')
  return value
})
```

## Vercel Integration

### Setup
```typescript
// src/index.ts
import { Elysia, t } from 'elysia'

export default new Elysia()
  .get('/', () => 'Hello Vercel')
  .post('/', ({ body }) => body, {
    body: t.Object({
      name: t.String()
    })
  })

export const GET = app.fetch
export const POST = app.fetch
```

### Vercel Config
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.x"
}
```

## Astro Integration

### Setup
```typescript
// pages/api/[...slugs].ts
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/api' })
  .get('/', () => 'Hello Astro')

const handle = ({ request }: { request: Request }) => app.handle(request)

export const GET = handle
export const POST = handle
```
