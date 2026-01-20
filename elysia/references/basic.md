# Routing & Validation

## Basic Routing

### HTTP Methods
```typescript
import { Elysia } from 'elysia'

new Elysia()
  .get('/', 'GET')
  .post('/', 'POST')
  .put('/', 'PUT')
  .patch('/', 'PATCH')
  .delete('/', 'DELETE')
  .options('/', 'OPTIONS')
  .head('/', 'HEAD')
```

### Path Parameters
```typescript
.get('/user/:id', ({ params: { id } }) => id)
.get('/post/:id/:slug', ({ params }) => params)
```

### Query Parameters
```typescript
.get('/search', ({ query }) => query.q)
// GET /search?q=elysia → "elysia"
```

### Request Body
```typescript
.post('/user', ({ body }) => body)
```

### Headers
```typescript
.get('/', ({ headers }) => headers.authorization)
```

## TypeBox Validation

### Basic Types
```typescript
import { Elysia, t } from 'elysia'

.post('/user', ({ body }) => body, {
  body: t.Object({
    name: t.String(),
    age: t.Number(),
    email: t.String({ format: 'email' }),
    website: t.Optional(t.String({ format: 'uri' }))
  })
})
```

### Nested Objects
```typescript
body: t.Object({
  user: t.Object({
    name: t.String(),
    address: t.Object({
      street: t.String(),
      city: t.String()
    })
  })
})
```

### Arrays
```typescript
body: t.Object({
  tags: t.Array(t.String()),
  users: t.Array(t.Object({
    id: t.String(),
    name: t.String()
  }))
})
```

### File Upload
```typescript
.post('/upload', ({ body }) => body.file, {
  body: t.Object({
    file: t.File({
      type: 'image',              // image/* mime types
      maxSize: '5m'               // 5 megabytes
    }),
    files: t.Files({              // Multiple files
      type: ['image/png', 'image/jpeg']
    })
  })
})
```

### Response Validation
```typescript
.get('/user/:id', ({ params: { id } }) => ({
  id,
  name: 'John',
  email: 'john@example.com'
}), {
  params: t.Object({
    id: t.Number()
  }),
  response: {
    200: t.Object({
      id: t.Number(),
      name: t.String(),
      email: t.String()
    }),
    404: t.String()
  }
})
```

## Standard Schema (Zod, Valibot, ArkType)

### Zod
```typescript
import { z } from 'zod'

.post('/user', ({ body }) => body, {
  body: z.object({
    name: z.string(),
    age: z.number().min(0),
    email: z.string().email()
  })
})
```

### Valibot
```typescript
import * as v from 'valibot'

.post('/user', ({ body }) => body, {
  body: v.object({
    name: v.string(),
    age: v.number([v.minValue(0)]),
    email: v.pipe(v.string(), v.email())
  })
})
```

## Model Reuse

```typescript
const UserModel = t.Object({
  name: t.String(),
  email: t.String({ format: 'email' })
})

new Elysia()
  .model({
    user: UserModel
  })
  .post('/user', ({ body }) => body, {
    body: 'user'              // Reference by name
  })
  .get('/users', () => [], {
    response: t.Array('user')  // Can be used in response too
  })
```

## Error Handling

```typescript
.get('/user/:id', ({ params: { id }, status }) => {
  const user = findUser(id)
  
  if (!user) {
    return status(404, 'User not found')
  }
  
  return user
})
```

## Guards (Apply to Multiple Routes)

```typescript
.guard({
  params: t.Object({
    id: t.Number()
  })
}, app => app
  .get('/user/:id', ({ params: { id } }) => id)
  .delete('/user/:id', ({ params: { id } }) => id)
)
```
