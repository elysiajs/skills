---
name: elysiajs
description: Expert knowledge for building type-safe, high-performance backend servers with ElysiaJS.
---

# ElysiaJS Development Skill

Always consult [elysiajs.com/llms.txt](https://elysiajs.com/llms.txt) for code examples and latest API.

## Overview

ElysiaJS is a TypeScript framework for building Bun-first (but not limited to Bun) type-safe, high-performance backend servers. This skill provides comprehensive guidance for developing with Elysia, including routing, validation, authentication, plugins, integrations, and deployment.

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
import { Elysia, t, status } from 'elysia'

const app = new Elysia()
  	.get('/', () => 'Hello World')
   	.post('/user', ({ body }) => body, {
    	body: t.Object({
      		name: t.String(),
        	age: t.Number()
     	})
    })
    .get('/id/:id', ({ params: { id } }) => {
   		if(id > 1_000_000) return status(404, 'Not Found')
     
     	return id
    }, {
    	params: t.Object({
     		id: t.Number({
       			minimum: 1
       		})
     	}),
     	response: {
      		200: t.Number(),
        	404: t.Literal('Not Found')
      	}
    })
    .listen(3000)
```

### Project Structure (Recommended)
Elysia takes an unopinionated approach but based on user request. But without any specific preference, we recommend a feature-based and domain driven folder structure where each feature has its own folder containing controllers, services, and models.

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

Each file has its own responsibility as follows:
- **Controller (index.ts)**: Handle HTTP routing, request validation, and cookie.
- **Service (service.ts)**: Handle business logic, decoupled from Elysia controller if possible.
- **Model (model.ts)**: Define the data structure and validation for the request and response.

## Best Practice
Elysia is unopinionated on design pattern, but if not provided, we can relies on MVC pattern pair with feature based folder structure.

- Controller:
	- Prefers Elysia as a controller for HTTP dependant controller
	- For non HTTP dependent, prefers service instead unless explicitly asked
	- Use `onError` to handle local custom errors
	- Register Model to Elysia instance via `Elysia.models({ ...models })` and prefix model by namespace `Elysia.prefix('model', 'Namespace.')
	- Prefers Reference Model by name provided by Elysia instead of using an actual `Model.name`
- Service:
	- Prefers class (or abstract class if possible)
	- Prefers interface/type derive from `Model`
	- Return `status` (`import { status } from 'elysia'`) for error
	- Prefers `return Error` instead of `throw Error`
- Models:
	- Always export validation model and type of validation model
	- Custom Error should be in contains in Model

## Core Concepts

## Key Concept
Elysia has a every important concepts that you need to understand to use.

### Encapsulation
Elysia lifecycle methods are **encapsulated** to its own instance only.

Which means if you create a new instance, it will not share the lifecycle methods with others.

```ts
import { Elysia } from 'elysia'

const profile = new Elysia()
	.onBeforeHandle(({ cookie }) => {
		throwIfNotSignIn(cookie)
	})
	.get('/profile', () => 'Hi there!')

const app = new Elysia()
	.use(profile)
	// This will NOT have sign in check
	.patch('/rename', ({ body }) => updateProfile(body))
```

In above example, the `isSignIn` check will only apply to `profile` but not `app`.

**Elysia isolate lifecycle by default** unless explicitly stated. This is similar to **export** in JavaScript, where you need to export the function to make it available outside the module.

To "export" the lifecycle to other instances, you must add specify the scope.

```ts
import { Elysia } from 'elysia'

const profile = new Elysia()
	.onBeforeHandle(
		{ as: 'global' }, // [!code ++]
		({ cookie }) => {
			throwIfNotSignIn(cookie)
		}
	)
	.get('/profile', () => 'Hi there!')

const app = new Elysia()
	.use(profile)
	// This has sign in check
	.patch('/rename', ({ body }) => updateProfile(body))
```

Casting lifecycle to **"global"** will export lifecycle to **every instance**.

### Encapsulation scope level
Elysia has 3 levels of scope as the following:

Scope type are as the following:
1. **local** (default) - apply to only current instance and descendant only
2. **scoped** - apply to parent, current instance and descendants
3. **global** - apply to all instance that apply the plugin (all parents, current, and descendants)

Let's review what each scope type does by using the following example:
```typescript
import { Elysia } from 'elysia'


const child = new Elysia()
    .get('/child', 'hi')

const current = new Elysia()
	// ? Value based on table value provided below
    .onBeforeHandle({ as: 'local' }, () => { // [!code ++]
        console.log('hi')
    })
    .use(child)
    .get('/current', 'hi')

const parent = new Elysia()
    .use(current)
    .get('/parent', 'hi')

const main = new Elysia()
    .use(parent)
    .get('/main', 'hi')
```

By changing the `type` value, the result should be as follows:

| type       | child | current | parent | main |
| ---------- | ----- | ------- | ------ | ---- |
| local      | ✅    | ✅      | ❌      | ❌   |
| scoped     | ✅    | ✅      | ✅      | ❌   |
| global     | ✅    | ✅      | ✅      | ✅   |

### Descendant

By default plugin will **apply hook to itself and descendants** only.

If the hook is registered in a plugin, instances that inherit the plugin will **NOT** inherit hooks and schema.

```typescript
import { Elysia } from 'elysia'

const plugin = new Elysia()
    .onBeforeHandle(() => {
        console.log('hi')
    })
    .get('/child', 'log hi')

const main = new Elysia()
    .use(plugin)
    .get('/parent', 'not log hi')
```

To apply hook to globally, we need to specify hook as global.
```typescript
import { Elysia } from 'elysia'

const plugin = new Elysia()
    .onBeforeHandle(() => {
        return 'hi'
    })
    .get('/child', 'child')
    .as('scoped')

const main = new Elysia()
    .use(plugin)
    .get('/parent', 'parent')
```

### Everything is a component

Every Elysia instance is a component.

A component is a plugin that could plug into other instances.

It could be a router, a store, a service, or anything else.

```ts
import { Elysia } from 'elysia'

const store = new Elysia()
	.state({ visitor: 0 })

const router = new Elysia()
	.use(store)
	.get('/increase', ({ store }) => store.visitor++)

const app = new Elysia()
	.use(router)
	.get('/', ({ store }) => store)
	.listen(3000)
```

This forces you to break down your application into small pieces, making it easy for you to add or remove features.

### Method Chaining
Elysia code should **ALWAYS** use method chaining, this is **important to ensure type safety**.

Every method in Elysia returns a new type reference, without using method chaining, Elysia doesn't save these new types, leading to no type inference.

Don't do:
```typescript
// Don't do
import { Elysia } from 'elysia'

const app = new Elysia()
app.state('build', 1)

// Type error "build" doesn't exists
app.get('/', ({ store: { build } }) => build)
app.listen(3000)
```

Do
```typescript
import { Elysia } from 'elysia'

const app = new Elysia()
	.state('build', 1)
	.get('/', ({ store: { build } }) => build)
	.listen(3000)
```

Always use method chaining to provide an accurate type inference.

## Dependency
Elysia by design, is compose of multiple mini Elysia apps which can run **independently** like a microservice that communicate with each other.

Each Elysia instance is independent and **can run as a standalone server**.

When an instance need to use another instance's service, you **must explicitly declare the dependency**.

```ts
import { Elysia } from 'elysia'

const auth = new Elysia()
	.decorate('Auth', Auth)
	.model(Auth.models)

// Don't
new Elysia()
 	// 'auth' is missing
	.get('/', ({ Auth }) => Auth.getProfile())

// Do
new Elysia()
	.use(auth)
	// auth is required to use Auth's service
	.get('/profile', ({ Auth }) => Auth.getProfile())
```

This is similar to **Dependency Injection** where each instance must declare its dependencies.

This approach force you to be explicit about dependencies allowing better tracking, modularity.

### Deduplication

By default, each plugin will be re-executed **every time** applying to another instance.

To prevent this, Elysia can deduplicate lifecycle with **an unique identifier** using `name` and optional `seed` property.

```ts
import { Elysia } from 'elysia'

const ip = new Elysia({ name: 'ip' })
	.derive(
		{ as: 'global' },
		({ server, request }) => ({
			ip: server?.requestIP(request)
		})
	)
	.get('/ip', ({ ip }) => ip)

const router1 = new Elysia()
	.use(ip)
	.get('/ip-1', ({ ip }) => ip)

const router2 = new Elysia()
	.use(ip)
	.get('/ip-2', ({ ip }) => ip)

const server = new Elysia()
	.use(router1)
	.use(router2)
```

Adding the `name` and optional `seed` to the instance will make it a unique identifier prevent it from being called multiple times.

### Global vs Explicit Dependency

There are some case that global dependency make more sense than an explicit one.

**Global** plugin example:
- **Plugin that doesn't add types** - eg. cors, compress, helmet
- Plugin that add global lifecycle that no instance should have control over - eg. tracing, logging

Example use cases:
- OpenAPI/Open - Global document
- OpenTelemetry - Global tracer
- Logging - Global logger

In case like this, it make more sense to create it as global dependency instead of applying it to every instance.

However, if your dependency doesn't fit into these categories, it's recommended to use **explicit dependency** instead.

**Explicit dependency** example:
- **Plugin that add types** - eg. macro, state, model
- Plugin that add business logic that instance can interact with - eg. Auth, Database

Example use cases:
- State management - eg. Store, Session
- Data modeling - eg. ORM, ODM
- Business logic - eg. Auth, Database
- Feature module - eg. Chat, Notification

### Order of code

The order of Elysia's life-cycle code is very important.

Because event will only apply to routes **after** it is registered.

If you put the onError before plugin, plugin will not inherit the onError event.

```typescript
import { Elysia } from 'elysia'

new Elysia()
 	.onBeforeHandle(() => {
        console.log('1')
    })
	.get('/', () => 'hi')
    .onBeforeHandle(() => {
        console.log('2')
    })
    .listen(3000)
```

Console should log the following:

```bash
1
```

Notice that it doesn't log **2**, because the event is registered after the route so it is not applied to the route.

Learn more about this in [order of code](/essential/life-cycle.html#order-of-code).

### Type Inference
Elysia has a complex type system that allows you to infer types from the instance.

```ts
import { Elysia, t } from 'elysia'

const app = new Elysia()
	.post('/', ({ body }) => body, {
		body: t.Object({
			name: t.String()
		})
	})
```

You should **always use an inline function** to provide an accurate type inference.

If you need to apply a separate function, eg. MVC's controller pattern, it's recommended to destructure properties from inline function to prevent unnecessary type inference as follows:

```ts
import { Elysia, t } from 'elysia'

abstract class Controller {
	static greet({ name }: { name: string }) {
		return 'hello ' + name
	}
}

const app = new Elysia()
	.post('/', ({ body }) => Controller.greet(body), {
		body: t.Object({
			name: t.String()
		})
	})
```

### TypeScript
We can get a type definitions of every Elysia/TypeBox's type by accessing `static` property as follows:

```ts
import { t } from 'elysia'

const MyType = t.Object({
	hello: t.Literal('Elysia')
})

type MyType = typeof MyType.static
```

This allows Elysia to infer and provide type automatically, reducing the need to declare duplicate schema

A single Elysia/TypeBox schema can be used for:
- Runtime validation
- Data coercion
- TypeScript type
- OpenAPI schema

This allows us to make a schema as a **single source of truth**.

## Resources
Use the following references as needed.

It's recommended to checkout `route.md` for as it contains the most important foundation building blocks with examples.

`plugin.md` and `validation.md` is important as well but can be check as needed.

### references/
Detailed documentation split by topic:
- `deployment.md` - Production setup
- `eden.md` - Elysia's type safe RPC client similar to tRPC
- `guard.md` - Setting validation/lifecycle all at once
- `macro.md` - Compose multiple schema/lifecycle as a reusable Elysia via key-value (recommended for complex setup, eg. authentication, authorization, Role-based Access Check)
- `plugin.md` - Decouple part of Elysia into a standalone component
- `route.md` - Elysia foundation building block: Routing, Handler and Context
- `testing.md` - Unit tests with examples
- `validation.md` - Setup input/output validation and list of all custom validation rules
- `websocket.md` - Real-time features

### examples/ (optional)
- `basic.ts` - Basic Elysia example
- `body-parser.ts` - Custom body parser example via `.onParse`
- `complex.ts` - Comprehensive usage of Elysia server
- `cookie.ts` - Setting cookie
- `error.ts` - Error handling
- `file.ts` - Returning local file from server
- `guard.ts` - Setting mulitple validation schema and lifecycle
- `map-response.ts` - Custom response mapper
- `redirect.ts` - Redirect response
- `rename.ts` - Rename context's property 
- `schema.ts` - Setup validation
- `state.ts` - Setup global state
- `upload-file.ts` - File upload with validation
- `websocket.ts` - Web Socket for realtime communication

### patterns/ (optional)
- `patterns/mvc.md` - Detail guideline for using Elysia with MVC patterns
