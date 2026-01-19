# Authentication Patterns

## Macro Pattern (Reusable Auth Check)

### Basic Macro
```typescript
import { Elysia, t } from 'elysia'

const app = new Elysia()
  .macro({
    auth: {
      cookie: t.Object({
        session: t.String()
      }),
      beforeHandle({ cookie: { session }, status }) {
        if (!session.value) {
          return status(401, 'Unauthorized')
        }
      }
    }
  })
  .get('/profile', ({ cookie }) => {
    return `Logged in as ${cookie.session.value}`
  }, {
    auth: true  // Apply the auth macro
  })
  .get('/settings', () => 'Settings', {
    auth: true  // Reuse on another route
  })
```

### Macro with Resolve (Add User to Context)
```typescript
.macro({
  auth: {
    cookie: t.Object({
      session: t.String()
    }),
    resolve({ cookie: { session }, status }) {
      if (!session.value) {
        return status(401)
      }
      
      // Fetch user from database
      const user = findUserBySession(session.value)
      if (!user) return status(401)
      
      return { user }  // Add user to context
    }
  }
})
.get('/profile', ({ user }) => user, {
  auth: true
})
```

### Role-Based Macro
```typescript
.macro({
  role: (requiredRole: 'user' | 'admin') => ({
    resolve({ headers: { authorization }, status }) {
      const token = authorization?.replace('Bearer ', '')
      if (!token) return status(401)
      
      const user = verifyToken(token)
      if (!user || user.role !== requiredRole) {
        return status(403, 'Forbidden')
      }
      
      return { user }
    }
  })
})
.get('/admin', ({ user }) => user, {
  role: 'admin'
})
.get('/user-only', ({ user }) => user, {
  role: 'user'
})
```

## Guard Pattern (Multiple Routes)

### Basic Guard
```typescript
new Elysia()
  .guard({
    beforeHandle({ headers, status }) {
      if (!headers.authorization) {
        return status(401)
      }
    }
  }, app => app
    .get('/profile', () => 'Profile')
    .get('/settings', () => 'Settings')
    .get('/orders', () => 'Orders')
  )
  .get('/public', () => 'Public route')  // Not protected
```

### Guard with Cookie Schema
```typescript
.guard({
  cookie: t.Object({
    session: t.String()
  }),
  beforeHandle({ cookie: { session }, status }) {
    if (!validateSession(session.value)) {
      return status(401)
    }
  }
}, app => app
  .get('/profile', ({ cookie }) => cookie.session.value)
  .get('/settings', () => 'Settings')
)
```

### Nested Guards
```typescript
.guard({
  // All routes must be authenticated
  beforeHandle: isAuthenticated
}, app => app
  .get('/user-route', () => 'User')
  .guard({
    // Additional admin check
    beforeHandle: isAdmin
  }, admin => admin
    .get('/admin', () => 'Admin')
    .delete('/user/:id', () => 'Delete user')
  )
)
```

## JWT Authentication

### Setup
```typescript
import { jwt } from '@elysiajs/jwt'

const app = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET!,
    exp: '7d'  // Token expiration
  }))
```

### Sign Token (Login)
```typescript
.post('/login', async ({ jwt, body, status }) => {
  const user = await validateCredentials(body.username, body.password)
  
  if (!user) {
    return status(401, 'Invalid credentials')
  }
  
  const token = await jwt.sign({
    userId: user.id,
    role: user.role
  })
  
  return { token }
}, {
  body: t.Object({
    username: t.String(),
    password: t.String()
  })
})
```

### Verify Token
```typescript
.get('/protected', async ({ jwt, headers, status }) => {
  const token = headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return status(401, 'No token provided')
  }
  
  const payload = await jwt.verify(token)
  
  if (!payload) {
    return status(401, 'Invalid token')
  }
  
  return { userId: payload.userId }
})
```

### JWT with Macro
```typescript
.macro({
  jwt: {
    resolve: async ({ jwt, headers, status }) => {
      const token = headers.authorization?.replace('Bearer ', '')
      if (!token) return status(401)
      
      const payload = await jwt.verify(token)
      if (!payload) return status(401, 'Invalid token')
      
      return { userId: payload.userId }
    }
  }
})
.get('/profile', ({ userId }) => ({ userId }), {
  jwt: true
})
```

## Session-Based Auth (Cookies)

### Login
```typescript
.post('/login', ({ body, cookie: { session } }) => {
  const user = validateCredentials(body.username, body.password)
  
  if (!user) {
    return { success: false }
  }
  
  session.set({
    value: generateSessionId(user.id),
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 86400  // 7 days
  })
  
  return { success: true }
})
```

### Protected Route
```typescript
.get('/profile', ({ cookie: { session }, status }) => {
  if (!session.value || !isValidSession(session.value)) {
    return status(401)
  }
  
  return getUserBySession(session.value)
})
```

### Logout
```typescript
.post('/logout', ({ cookie: { session } }) => {
  session.remove()
  return { success: true }
})
```

## Complete Auth Example

```typescript
import { Elysia, t } from 'elysia'

// Auth plugin with macro
const authPlugin = new Elysia({ name: 'auth' })
  .macro({
    auth: {
      cookie: t.Object({
        session: t.String()
      }),
      resolve({ cookie: { session }, status }) {
        if (!session.value) return status(401)
        
        const user = getUserBySession(session.value)
        if (!user) return status(401)
        
        return { user }
      }
    }
  })

// Main app
const app = new Elysia()
  .use(authPlugin)
  .post('/login', ({ body, cookie: { session } }) => {
    // Login logic
    session.value = createSession(body.username)
    return { success: true }
  })
  .get('/profile', ({ user }) => user, {
    auth: true
  })
  .listen(3000)
```
