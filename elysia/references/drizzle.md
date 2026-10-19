# Drizzle

Use Drizzle for queries and `drizzle-orm/typebox` to generate TypeBox 1.x schemas for Elysia v2 HTTP validation. Keep the generated schemas as the starting point for API contracts, then override fields where the public contract needs stricter rules or fewer fields.

## Install the TypeBox integration

The [Drizzle TypeBox guide](https://orm.drizzle.team/docs/typebox) currently installs the release candidate with TypeBox:

```sh
npm i drizzle-orm@rc typebox
```

Import generated schemas from `drizzle-orm/typebox` and TypeBox helpers from `typebox`. Do not use the legacy `drizzle-typebox` package with `@sinclair/typebox` 0.x in an Elysia v2 app.

## Generate Elysia schemas from a table

This example uses `drizzle-orm`, PostgreSQL, and `pg`. It requires a migrated `users` table and an existing `db` connection.

```ts
// database/schema.ts
import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	name: text('name').notNull()
})
```

```ts
// users.ts
import { Elysia, t } from 'elysia'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/typebox'
import { db } from './database'
import { users } from './database/schema'

const refineName = (schema: Parameters<typeof t.String>[0]) =>
	t.String({ ...schema, minLength: 1 })

const insertUser = createInsertSchema(users, { name: refineName })
const updateUser = createUpdateSchema(users, { name: refineName })

const createUserSchema = t.Pick(insertUser, ['name'], { additionalProperties: false })
const updateUserSchema = t.Pick(updateUser, ['name'], { additionalProperties: false })
const publicUserSchema = createSelectSchema(users)

export const userRoutes = new Elysia().post('/users', {
	body: createUserSchema,
	response: publicUserSchema
}, async ({ body }) => {
	const [user] = await db.insert(users).values(body).returning({
		id: users.id,
		name: users.name
	})
	if (!user) throw new Error('Insert returned no user')
	return user
})
```

Both request schemas allow only `name` as a writable field, keeping `id` under database control. The shared refinement rejects an empty name on creation and update. Use `updateUserSchema` for update request bodies; `name` remains optional, but must be nonempty when supplied.

Drizzle applies nullability and optionality after refinement callbacks. Use callbacks to preserve those rules when adding API constraints. Pick writable fields explicitly because generated insert and update schemas can include columns such as a serial primary key.

`createSelectSchema(users)` includes every table column. If the API should expose only some columns, pick them explicitly from the generated schema or define a smaller response schema. `returning()` depends on the database dialect. Use the dialect's supported insert and read operations. Convert database values, such as decimals or dates, to the declared HTTP types.

These Elysia schemas also feed [OpenAPI](openapi.md) and [Eden](eden.md). See [validation](validation.md) for shared models and schema-derived types.
