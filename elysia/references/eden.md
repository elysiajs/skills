# Eden Treaty

Eden Treaty is an object representation to interact with a server and features type safety, auto-completion, and error handling.

To use Eden Treaty, first export your existing Elysia server type:

# Installation

1. Start by installing Eden on your frontend:

```bash
bun add @elysiajs/eden
bun add -d elysia
```

Note: Eden needs Elysia to infer utilities type. Make sure to install Elysia with the version matching on the server.

2. First, export your existing Elysia server type:

```typescript
// server.ts
import { Elysia, t } from 'elysia'

const app = new Elysia()
    .get('/', () => 'Hi Elysia')
    .get('/id/:id', ({ params: { id } }) => id)
    .post('/mirror', ({ body }) => body, {
        body: t.Object({
            id: t.Number(),
            name: t.String()
        })
    })
    .listen(3000)

export type App = typeof app
```

3. Then consume the Elysia API on client side:

```typescript twoslash
import { treaty } from '@elysiajs/eden'
import type { App } from './server'

const client = treaty<App>('localhost:3000')

// response: Hi Elysia
const { data: index } = await client.get()

// response: 1895
const { data: id } = await client.id({ id: 1895 }).get()

// response: { id: 1895, name: 'Skadi' }
const { data: nendoroid } = await client.mirror.post({
    id: 1895,
    name: 'Skadi'
})
```

### Common Installation Error

Sometimes, Eden may not infer types from Elysia correctly, the following are the most common workarounds to fix Eden type inference.

### Type Strict

Make sure to enable strict mode in **tsconfig.json**

```json
{
    "compilerOptions": {
        "strict": true
    }
}
```

### Unmatch Elysia version

Eden depends on Elysia class to import Elysia instance and infer types correctly.

Make sure that both client and server have the matching Elysia version.

You can check it with [`npm why`](https://docs.npmjs.com/cli/v10/commands/npm-explain) command:

```bash
npm why elysia
```

And output should contain only one elysia version on top-level:

```
elysia@1.1.12
node_modules/elysia
  elysia@"1.1.25" from the root project
  peer elysia@">= 1.1.0" from @elysiajs/html@1.1.0
  node_modules/@elysiajs/html
    dev @elysiajs/html@"1.1.1" from the root project
  peer elysia@">= 1.1.0" from @elysiajs/opentelemetry@1.1.2
  node_modules/@elysiajs/opentelemetry
    dev @elysiajs/opentelemetry@"1.1.7" from the root project
  peer elysia@">= 1.1.0" from @elysiajs/swagger@1.1.0
  node_modules/@elysiajs/swagger
    dev @elysiajs/swagger@"1.1.6" from the root project
  peer elysia@">= 1.1.0" from @elysiajs/eden@1.1.2
  node_modules/@elysiajs/eden
    dev @elysiajs/eden@"1.1.3" from the root project
```

### TypeScript version

Elysia uses newer features and syntax of TypeScript to infer types in the most performant way. Features like Const Generic and Template Literal are heavily used.

Make sure your client has a **minimum TypeScript version if >= 5.0**

### Method Chaining

To make Eden work, Elysia must use **method chaining**

Elysia's type system is complex, methods usually introduce a new type to the instance.

Using method chaining will help save that new type reference.

For example:

```typescript twoslash
import { Elysia } from 'elysia'

new Elysia()
    .state('build', 1)
    // Store is strictly typed
    .get('/', ({ store: { build } }) => build)
    .listen(3000)
```

Using this, **state** now returns a new **ElysiaInstance** type, introducing **build** into store replacing the current one.

Without method chaining, Elysia doesn't save the new type when introduced, leading to no type inference.

```typescript twoslash
// @errors: 2339
import { Elysia } from 'elysia'

const app = new Elysia()

app.state('build', 1)

app.get('/', ({ store: { build } }) => build)

app.listen(3000)
```

### Type Definitions

If you are using a Bun specific feature, like `Bun.file` or similar API and return it from a handler, you may need to install Bun type definitions to the client as well.

```bash
bun add -d @types/bun
```

### Path alias (monorepo)

If you are using path alias in your monorepo, make sure that frontend is able to resolve the path as same as backend.

::: tip
Setting up path alias in monorepo is a bit tricky, you can fork our example template: [Kozeki Template](https://github.com/SaltyAom/kozeki-template) and modify it to your needs.
:::

For example, if you have the following path alias for your backend in **tsconfig.json**:

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@/*": ["./src/*"]
        }
    }
}
```

And your backend code is like this:

```typescript
import { Elysia } from 'elysia'
import { a, b } from '@/controllers'

const app = new Elysia().use(a).use(b).listen(3000)

export type app = typeof app
```

You **must** make sure that your frontend code is able to resolve the same path alias. Otherwise, type inference will be resolved as any.

```typescript
import { treaty } from '@elysiajs/eden'
import type { app } from '@/index'

const client = treaty<app>('localhost:3000')

// This should be able to resolve the same module both frontend and backend, and not `any`
import { a, b } from '@/controllers'
```

To fix this, you must make sure that path alias is resolved to the same file in both frontend and backend.

So, you must change the path alias in **tsconfig.json** to:

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@/*": ["../apps/backend/src/*"]
        }
    }
}
```

If configured correctly, you should be able to resolve the same module in both frontend and backend.

```typescript
// This should be able to resolve the same module both frontend and backend, and not `any`
import { a, b } from '@/controllers'
```

#### Namespace

We recommended adding a **namespace** prefix for each module in your monorepo to avoid any confusion and conflict that may happen.

```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@frontend/*": ["./apps/frontend/src/*"],
            "@backend/*": ["./apps/backend/src/*"]
        }
    }
}
```

Then, you can import the module like this:

```typescript
// Should work in both frontend and backend and not return `any`
import { a, b } from '@backend/controllers'
```

We recommend creating a **single tsconfig.json** that defines a `baseUrl` as the root of your repo, provide a path according to the module location, and create a **tsconfig.json** for each module that inherits the root **tsconfig.json** which has the path alias.

## Basic Usage

```typescript
// server.ts
import { Elysia, t } from 'elysia'

const app = new Elysia()
    .get('/hi', () => 'Hi Elysia')
    .get('/id/:id', ({ params: { id } }) => id)
    .post('/mirror', ({ body }) => body, {
        body: t.Object({
            id: t.Number(),
            name: t.String()
        })
    })
    .listen(3000)

export type App = typeof app
```

Then import the server type and consume the Elysia API on the client:

```typescript twoslash
import { treaty } from '@elysiajs/eden'
import type { App } from './server'

const app = treaty<App>('localhost:3000')

// response type: 'Hi Elysia'
const { data, error } = await app.hi.get()
// ^?
```

## Tree like syntax

HTTP Path is a resource indicator for a file system tree.

File system consists of multiple levels of folders, for example:

- /documents/elysia
- /documents/kalpas
- /documents/kelvin

Each level is separated by **/** (slash) and a name.

However in JavaScript, instead of using **"/"** (slash) we use **"."** (dot) to access deeper resources.

Eden Treaty turns an Elysia server into a tree-like file system that can be accessed in the JavaScript frontend instead.

| Path         | Treaty       |
| ------------ | ------------ |
| /            |              |
| /hi          | .hi          |
| /deep/nested | .deep.nested |

Combined with the HTTP method, we can interact with the Elysia server.

| Path         | Method | Treaty              |
| ------------ | ------ | ------------------- |
| /            | GET    | .get()              |
| /hi          | GET    | .hi.get()           |
| /deep/nested | GET    | .deep.nested.get()  |
| /deep/nested | POST   | .deep.nested.post() |

## Dynamic path

However, dynamic path parameters cannot be expressed using notation. If they are fully replaced, we don't know what the parameter name is supposed to be.

```typescript
// ❌ Unclear what the value is supposed to represent?
treaty.item['skadi'].get()
```

To handle this, we can specify a dynamic path using a function to provide a key value instead.

```typescript
// ✅ Clear that value is dynamic path is 'name'
treaty.item({ name: 'Skadi' }).get()
```

| Path           | Treaty                      |
| -------------- | --------------------------- |
| /item          | .item                       |
| /item/:name    | .item({ name: 'Skadi' })    |
| /item/:name/id | .item({ name: 'Skadi' }).id |

## Parameters

We need to send a payload to server eventually.

To handle this, Eden Treaty's methods accept 2 parameters to send data to server.

Both parameters are type safe and will be guided by TypeScript automatically:

1. body
2. additional parameters
    - query
    - headers
    - fetch

```typescript
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia()
    .post('/user', ({ body }) => body, {
        body: t.Object({
            name: t.String()
        })
    })
    .listen(3000)

const api = treaty<typeof app>('localhost:3000')

// ✅ works
api.user.post({
    name: 'Elysia'
})

// ✅ also works
api.user.post(
    {
        name: 'Elysia'
    },
    {
        // This is optional as not specified in schema
        headers: {
            authorization: 'Bearer 12345'
        },
        query: {
            id: 2
        }
    }
)
```

Unless if the method doesn't accept body, then body will be omitted and left with single parameter only.

If the method **"GET"** or **"HEAD"**:

1. Additional parameters
    - query
    - headers
    - fetch

```typescript
import { Elysia } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia().get('/hello', () => 'hi').listen(3000)

const api = treaty<typeof app>('localhost:3000')

// ✅ works
api.hello.get({
    // This is optional as not specified in schema
    headers: {
        hello: 'world'
    }
})
```

### Empty body

If body is optional or not need but query or headers is required, you may pass the body as `null` or `undefined` instead.

```typescript
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia()
    .post('/user', () => 'hi', {
        query: t.Object({
            name: t.String()
        })
    })
    .listen(3000)

const api = treaty<typeof app>('localhost:3000')

api.user.post(null, {
    query: {
        name: 'Ely'
    }
})
```

### Fetch parameters

Eden Treaty is a fetch wrapper, we may add any valid [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) parameters to Eden by passing it to `$fetch`:

```typescript
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia().get('/hello', () => 'hi').listen(3000)

const api = treaty<typeof app>('localhost:3000')

const controller = new AbortController()

const cancelRequest = setTimeout(() => {
    controller.abort()
}, 5000)

await api.hello.get({
    fetch: {
        signal: controller.signal
    }
})

clearTimeout(cancelRequest)
```

### File Upload

We may either pass one of the following to attach file(s):

- **File**
- **File[]**
- **FileList**
- **Blob**

Attaching a file will results **content-type** to be **multipart/form-data**

Suppose we have the server as the following:

```typescript
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia()
    .post('/image', ({ body: { image, title } }) => title, {
        body: t.Object({
            title: t.String(),
            image: t.Files()
        })
    })
    .listen(3000)

export const api = treaty<typeof app>('localhost:3000')

const images = document.getElementById('images') as HTMLInputElement

const { data } = await api.image.post({
    title: 'Misono Mika',
    image: images.files!
})
```

## Response

Once the fetch method is called, Eden Treaty returns a `Promise` containing an object with the following properties:

- data - returned value of the response (2xx)
- error - returned value from the response (>= 3xx)
- response `Response` - Web Standard Response class
- status `number` - HTTP status code
- headers `FetchRequestInit['headers']` - response headers

Once returned, you must provide error handling to ensure that the response data value is unwrapped, otherwise the value will be nullable. Elysia provides a `error()` helper function to handle the error, and Eden will provide type narrowing for the error value.

```typescript
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia()
    .post(
        '/user',
        ({ body: { name }, status }) => {
            if (name === 'Otto') return status(400)

            return name
        },
        {
            body: t.Object({
                name: t.String()
            })
        }
    )
    .listen(3000)

const api = treaty<typeof app>('localhost:3000')

const submit = async (name: string) => {
    const { data, error } = await api.user.post({
        name
    })

    // type: string | null
    console.log(data)

    if (error)
        switch (error.status) {
            case 400:
                // Error type will be narrow down
                throw error.value

            default:
                throw error.value
        }

    // Once the error is handled, type will be unwrapped
    // type: string
    return data
}
```

By default, Elysia infers `error` and `response` types to TypeScript automatically, and Eden will be providing auto-completion and type narrowing for accurate behavior.

tip: If the server responds with an HTTP status >= 300, then the value will always be `null`, and `error` will have a returned value instead. Otherwise, response will be passed to `data`.

## Stream response

Eden will interpret a stream response or [Server-Sent Events](/essential/handler.html#server-sent-events-sse) as `AsyncGenerator` allowing us to use `for await` loop to consume the stream.

```typescript twoslash [Stream]
import { Elysia } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia().get('/ok', function* () {
    yield 1
    yield 2
    yield 3
})

const { data, error } = await treaty(app).ok.get()
if (error) throw error

for await (const chunk of data) console.log(chunk)
```

### Server-Sent Event

```typescript
import { Elysia, sse } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia().get('/ok', function* () {
    yield sse({
        event: 'message',
        data: 1
    })
    yield sse({
        event: 'message',
        data: 2
    })
    yield sse({
        event: 'end'
    })
})

const { data, error } = await treaty(app).ok.get()
if (error) throw error

for await (const chunk of data) console.log(chunk)
```

## Utility type

Eden Treaty provides a utility type `Treaty.Data<T>` and `Treaty.Error<T>` to extract the `data` and `error` type from the response.

```typescript twoslash
import { Elysia, t } from 'elysia'

import { treaty, Treaty } from '@elysiajs/eden'

const app = new Elysia()
    .post(
        '/user',
        ({ body: { name }, status }) => {
            if (name === 'Otto') return status(400)

            return name
        },
        {
            body: t.Object({
                name: t.String()
            })
        }
    )
    .listen(3000)

const api = treaty<typeof app>('localhost:3000')

type UserData = Treaty.Data<typeof api.user.post>

// Alternatively you can also pass a response
const response = await api.user.post({
    name: 'Saltyaom'
})

type UserDataFromResponse = Treaty.Data<typeof response>
type UserError = Treaty.Error<typeof api.user.post>
```

## WebSocket

Eden Treaty supports WebSocket using `subscribe` method.

```typescript twoslash
import { Elysia, t } from 'elysia'
import { treaty } from '@elysiajs/eden'

const app = new Elysia()
    .ws('/chat', {
        body: t.String(),
        response: t.String(),
        message(ws, message) {
            ws.send(message)
        }
    })
    .listen(3000)

const api = treaty<typeof app>('localhost:3000')

const chat = api.chat.subscribe()

chat.subscribe((message) => {
    console.log('got', message)
})

chat.on('open', () => {
    chat.send('hello from client')
})
```

**.subscribe** accepts the same parameter as `get` and `head`.

## WebSocket Response

**Eden.subscribe** returns **EdenWS** which extends the [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket) results in identical syntax.

If more control is need, **EdenWebSocket.raw** can be accessed to interact with the native WebSocket API.
