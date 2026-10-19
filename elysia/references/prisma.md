# Prisma

Use the project's generated Prisma client and driver setup. Elysia needs no Prisma plugin. Keep HTTP validation separate unless a compatible generator is available.

## Query from a validated route

This example assumes `./database` exports `prisma` and the generated client has a `User` model with string `id` and `email` fields.

```ts
import { Elysia, t } from 'elysia'
import { prisma } from './database'

const publicUser = t.Object({
	id: t.String(),
	email: t.String({ format: 'email' })
})

export const userRoutes = new Elysia()
	.post('/users', {
		body: t.Object({ email: t.String({ format: 'email' }) }),
		response: publicUser
	}, ({ body }) => prisma.user.create({
		data: body,
		select: { id: true, email: true }
	}))
	.get('/users/:id', {
		response: { 200: publicUser, 404: t.String() }
	}, async ({ params, status }) => {
		const user = await prisma.user.findUnique({
			where: { id: params.id },
			select: { id: true, email: true }
		})
		if (!user) return status(404, 'User not found')
		return user
	})
```

Select public fields explicitly. Map expected database failures, such as unique constraint violations, to declared HTTP errors. See [errors](errors.md).

## Generate schemas with Prismabox

Prismabox is optional. Verify support for Elysia v2's TypeBox 1.x output. Changing the import name does not establish compatibility.

Add this generator to the existing Prisma schema:

```prisma
generator prismabox {
  provider = "prismabox"
  typeboxImportDependencyName = "elysia"
  typeboxImportVariableName = "t"
  inputModel = true
  output = "../generated/prismabox"
}
```

Run the project's Prisma generator and inspect its exports. If it generates `UserPlain` and `UserPlainInputCreate` in `generated/prismabox/User.ts`, select public fields before using them as `response` and `body`.

Generated database input models can include fields that an HTTP client must not control. Derive the API input with `t.Pick` or define an explicit schema. Verify validation and [OpenAPI](openapi.md) output against the installed generator.

Prisma initialization varies by version. Prisma 7 moves the CLI datasource URL to `prisma.config.ts`; driver adapters still need runtime connection settings. Keep the project's working client setup.
