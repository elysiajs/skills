import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { drizzle } from 'drizzle-orm/bun-sqlite'
// import { users } from './schema'

const db = drizzle(/* connection config */)

const app = new Elysia()
  .use(cors())
  .decorate('db', db)
  .get('/users', ({ db }) => {
    // return db.select().from(users)
    return []
  })
  .post('/user', ({ db, body }) => {
    // return db.insert(users).values(body)
    return body
  }, {
    body: t.Object({
      name: t.String(),
      email: t.String({ format: 'email' })
    })
  })
  .get('/user/:id', ({ db, params: { id } }) => {
    // return db.select().from(users).where(eq(users.id, id))
    return { id }
  })
  .listen(3000)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
