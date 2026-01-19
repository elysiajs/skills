import { Elysia, t } from 'elysia'

const app = new Elysia()
  .get('/', 'Hello World')
  .get('/health', () => ({ status: 'ok', timestamp: Date.now() }))
  .listen(3000)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
