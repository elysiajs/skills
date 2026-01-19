import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { jwt } from '@elysiajs/jwt'

const app = new Elysia()
  .use(cors())
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET!
  }))
  .post('/login', async ({ jwt, body }) => {
    // TODO: Validate credentials
    const token = await jwt.sign({
      userId: body.userId,
      role: 'user'
    })
    
    return { token }
  }, {
    body: t.Object({
      userId: t.String(),
      password: t.String()
    })
  })
  .get('/protected', async ({ jwt, headers, status }) => {
    const token = headers.authorization?.replace('Bearer ', '')
    if (!token) return status(401, 'No token')
    
    const payload = await jwt.verify(token)
    if (!payload) return status(401, 'Invalid token')
    
    return { userId: payload.userId }
  })
  .listen(3000)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
