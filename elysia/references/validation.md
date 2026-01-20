# Validation

Elysia provides a schema to validate data out of the box to ensure that the data is in the correct format.

## Basic Usage
```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
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
	.post('/file', () => {
		
	}, {
		body: t.Object({
			image: t.File({
				type: ['image/jpeg', 'image/png'],
				maxSize: '1m'
			})
		})
	})
    .listen(3000)
```

Validation schema should be provided as third parameter of HTTP method with one of the following schema type:
- [#body](Body) - Incoming HTTP Message
- [#query](Query) - Query string or URL parameter
- [#params](Params) - Path parameters
- [#headers](Headers) - Headers of the request
- [#cookie](Cookie) - Cookie of the request
- [#response](Response) - Response of the request

### TypeBox

**Elysia.t** is a schema builder based on TypeBox that provides type-safety at runtime, compile-time, and OpenAPI schema generation from a single source of truth.

### Standard Schema
Elysia also support [Standard Schema](https://github.com/standard-schema/standard-schema), allowing you to use your favorite validation library:
- Zod
- Valibot
- ArkType
- Effect Schema
- Yup
- Joi

To use Standard Schema, simply import the schema and provide it to the route handler.

```typescript twoslash
import { Elysia } from 'elysia'
import { z } from 'zod'
import * as v from 'valibot'

new Elysia()
	.get('/id/:id', ({ params: { id }, query: { name } }) => id, {
		params: z.object({
			id: z.coerce.number()
		}),
		query: v.object({
			name: v.literal('Lilith')
		})
	})
	.listen(3000)
```

You can use any validator together in the same handler without any issue.

## Body
An incoming [HTTP Message](https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages) is the data sent to the server. It can be in the form of JSON, form-data, or any other format.

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.post('/body', ({ body }) => body, {
		body: t.Object({
			name: t.String()
		})
	})
	.listen(3000)
```

The validation should be as follows:
| Body | Validation |
| --- | --------- |
| \{ name: 'Elysia' \} | ✅ |
| \{ name: 1 \} | ❌ |
| \{ alias: 'Elysia' \} | ❌ |
| `undefined` | ❌ |

Elysia disables body-parser for **GET** and **HEAD** messages by default, following the specs of HTTP/1.1 [RFC2616](https://www.rfc-editor.org/rfc/rfc2616#section-4.3)

> If the request method does not include defined semantics for an entity-body, then the message-body SHOULD be ignored when handling the request.

Most browsers disable the attachment of the body by default for **GET** and **HEAD** methods.

#### Specs
Validate an incoming [HTTP Message](https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages) (or body).

These messages are additional messages for the web server to process.

The body is provided in the same way as the `body` in `fetch` API. The content type should be set accordingly to the defined body.

```typescript
fetch('https://elysiajs.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        name: 'Elysia'
    })
})
```

### File
File is a special type of body that can be used to upload files.
```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.post('/body', ({ body }) => body, {
		body: t.Object({
			file: t.File({ format: 'image/*' }),
			multipleFiles: t.Files()
		})
	})
	.listen(3000)
```

By providing a file type, Elysia will automatically assume that the content-type is `multipart/form-data`.

### File (Standard Schema)
If you're using Standard Schema, it's important that Elysia will not be able to validate content type automatically similar to `t.File`.

But Elysia export a `fileType` that can be used to validate file type by using magic number.

```typescript twoslash
import { Elysia, fileType } from 'elysia'
import { z } from 'zod'

new Elysia()
	.post('/body', ({ body }) => body, {
		body: z.object({
			file: z.file().refine((file) => fileType(file, 'image/jpeg'))
		})
	})
```

It's very important that you **should use** `fileType` to validate the file type as **most validator doesn't actually validate the file** correctly, like checking the content type the value of it which can lead to security vulnerability.

## Query
Query is the data sent through the URL. It can be in the form of `?key=value`.

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/query', ({ query }) => query, {
		query: t.Object({
			name: t.String()
		})
	})
	.listen(3000)
```

Query must be provided in the form of an object.

The validation should be as follows:
| Query | Validation |
| ---- | --------- |
| /?name=Elysia | ✅ |
| /?name=1 | ✅ |
| /?alias=Elysia | ❌ |
| /?name=ElysiaJS&alias=Elysia | ✅ |
| / | ❌ |

#### Specs

A query string is a part of the URL that starts with **?** and can contain one or more query parameters, which are key-value pairs used to convey additional information to the server, usually for customized behavior like filtering or searching.

Query is provided after the **?** in Fetch API.

```typescript
fetch('https://elysiajs.com/?name=Elysia')
```

When specifying query parameters, it's crucial to understand that all query parameter values must be represented as strings. This is due to how they are encoded and appended to the URL.

### Coercion
Elysia will coerce applicable schema on `query` to respective type automatically.

```ts twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/', ({ query }) => query, {
		query: t.Object({
			name: t.Number()
		})
	})
	.listen(3000)
```

### Array
By default, Elysia treat query parameters as a single string even if specified multiple time.

To use array, we need to explicitly declare it as an array.

```ts twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/', ({ query }) => query, {
		query: t.Object({
			name: t.Array(t.String())
		})
	})
	.listen(3000)
```

Once Elysia detect that a property is assignable to array, Elysia will coerce it to an array of the specified type.

By default, Elysia format query array with the following format:

#### nuqs
This format is used by [nuqs](https://nuqs.47ng.com).

By using **,** as a delimiter, a property will be treated as array.

```
http://localhost?name=rapi,anis,neon&squad=counter
{
	name: ['rapi', 'anis', 'neon'],
	squad: 'counter'
}
```

#### HTML form format
If a key is assigned multiple time, the key will be treated as an array.

This is similar to HTML form format when an input with the same name is specified multiple times.

```
http://localhost?name=rapi&name=anis&name=neon&squad=counter
// name: ['rapi', 'anis', 'neon']
```

## Params
Params or path parameters are the data sent through the URL path.

They can be in the form of `/key`.

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/id/:id', ({ params }) => params, {
		params: t.Object({
			id: t.Number()
		})
	})
```

Params must be provided in the form of an object.

The validation should be as follows:
| URL | Validation |
| --- | --------- |
| /id/1 | ✅ |
| /id/a | ❌ |

#### Specs
Path parameter <small>(not to be confused with query string or query parameter)</small>.

**This field is usually not needed as Elysia can infer types from path parameters automatically**, unless there is a need for a specific value pattern, such as a numeric value or template literal pattern.

```typescript
fetch('https://elysiajs.com/id/1')
```

### Params type inference
If a params schema is not provided, Elysia will automatically infer the type as a string.
```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/id/:id', ({ params }) => params)
```

## Headers
Headers are the data sent through the request's header.

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/headers', ({ headers }) => headers, {
		headers: t.Object({
			authorization: t.String()
		})
	})
```

Unlike other types, headers have `additionalProperties` set to `true` by default.

This means that headers can have any key-value pair, but the value must match the schema.

#### Specs
HTTP headers let the client and the server pass additional information with an HTTP request or response, usually treated as metadata.

This field is usually used to enforce some specific header fields, for example, `Authorization`.

Headers are provided in the same way as the `body` in `fetch` API.

```typescript
fetch('https://elysiajs.com/', {
    headers: {
        authorization: 'Bearer 12345'
    }
})
```

::: tip
Elysia will parse headers as lower-case keys only.

Please make sure that you are using lower-case field names when using header validation.
:::

## Cookie
Cookie is the data sent through the request's cookie.

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/cookie', ({ cookie }) => cookie, {
		cookie: t.Cookie({
			cookieName: t.String()
		})
	})
```

Cookies must be provided in the form of `t.Cookie` or `t.Object`.

Same as `headers`, cookies have `additionalProperties` set to `true` by default.

#### Specs

An HTTP cookie is a small piece of data that a server sends to the client. It's data that is sent with every visit to the same web server to let the server remember client information.

In simpler terms, it's a stringified state that is sent with every request.

This field is usually used to enforce some specific cookie fields.

A cookie is a special header field that the Fetch API doesn't accept a custom value for but is managed by the browser. To send a cookie, you must use a `credentials` field instead:

```typescript
fetch('https://elysiajs.com/', {
    credentials: 'include'
})
```

### t.Cookie
`t.Cookie` is a special type that is equivalent to `t.Object` but allows to set cookie-specific options.

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/cookie', ({ cookie }) => cookie.name.value, {
		cookie: t.Cookie({
			name: t.String()
		}, {
			secure: true,
			httpOnly: true
		})
	})
```

## Response
Response is the data returned from the handler.

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/response', () => {
		return {
			name: 'Jane Doe'
		}
	}, {
		response: t.Object({
			name: t.String()
		})
	})
```

### Response per status
Responses can be set per status code.

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
	.get('/response', ({ status }) => {
		if (Math.random() > 0.5)
			return status(400, {
				error: 'Something went wrong'
			})

		return {
			name: 'Jane Doe'
		}
	}, {
		response: {
			200: t.Object({
				name: t.String()
			}),
			400: t.Object({
				error: t.String()
			})
		}
	})
```

This is an Elysia-specific feature, allowing us to make a field optional.

## Error Provider

There are two ways to provide a custom error message when the validation fails:

1. Inline `status` property
2. Using `onError` hook

### Error Property

Elysia offers an additional **error** property, allowing us to return a custom error message if the field is invalid.

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
    .post('/', () => 'Hello World!', {
        body: t.Object({
            x: t.Number({
               	error: 'x must be a number'
            })
        })
    })
    .listen(3000)
```

The following is an example of using the error property on various types:

| TypeBox | Error |
|--------|-------|
| t.String({ format: 'email', error: 'Invalid email :('}) | Invalid Email :( |
| t.Array(t.String(), { error: 'All members must be a string' }) | All members must be a string |
| t.Object({ x: t.Number()}, { error: 'Invalid object UmU' }) | Invalid object UnU |
| t.Object({ x: t.Number({ error({ errors, type, validation, value }) { return 'Expected x to be a number' } })}) | Expected x to be a number |

### Error message as function
In addition to a string, Elysia type's error can also accept a function to programmatically return a custom error for each property.

The error function accepts the same arguments as `ValidationError`

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
    .post('/', () => 'Hello World ', {
        body: t.Object({
            x: t.Number({
                error() {
                    return 'Expected x to be a number'
                }
            })
        })
    })
    .listen(3000)
```

::: tip
Hover over the `error` to see the type.
:::

### onError

We can customize the behavior of validation based on the `onError` event by narrowing down the error code to "**VALIDATION**".

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
	.onError(({ code, error }) => {
		if (code === 'VALIDATION')
		    return error.message
	})
	.listen(3000)
```

The narrowed-down error type will be typed as `ValidationError` imported from **elysia/error**.

**ValidationError** exposes a property named **validator**, typed as `TypeCheck` allowing us to interact with TypeBox functionality out of the box.

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
    .onError(({ code, error }) => {
        if (code === 'VALIDATION')
            return error.all[0].message
    })
    .listen(3000)
```

### Error List

**ValidationError** provides a method `ValidatorError.all`, allowing us to list all of the error causes.

```typescript
import { Elysia, t } from 'elysia'

new Elysia()
	.post('/', ({ body }) => body, {
		body: t.Object({
			name: t.String(),
			age: t.Number()
		}),
		error({ code, error }) {
			switch (code) {
				case 'VALIDATION':
                    console.log(error.all)

                    // Find a specific error name (path is OpenAPI Schema compliance)
                    const name = error.all.find(
						(x) => x.summary && x.path === '/name'
					)

                    // If there is a validation error, then log it
                    if(name)
    					console.log(name)
			}
		}
	})
	.listen(3000)
```

## Reference Model
Sometimes you might find yourself declaring duplicate models or re-using the same model multiple times.

With a reference model, we can name our model and reuse it by referencing the name.

Let's start with a simple scenario.

Suppose we have a controller that handles sign-in with the same model.

```typescript twoslash
import { Elysia, t } from 'elysia'

const app = new Elysia()
    .post('/sign-in', ({ body }) => body, {
        body: t.Object({
            username: t.String(),
            password: t.String()
        }),
        response: t.Object({
            username: t.String(),
            password: t.String()
        })
    })
```

We can refactor the code by extracting the model as a variable and referencing it.
```typescript twoslash
import { Elysia, t } from 'elysia'

// Maybe in a different file eg. models.ts
const SignDTO = t.Object({
    username: t.String(),
    password: t.String()
})

const app = new Elysia()
    .post('/sign-in', ({ body }) => body, {
        body: SignDTO,
        response: SignDTO
    })
```

This method of separating concerns is an effective approach, but we might find ourselves reusing multiple models with different controllers as the app gets more complex.

We can resolve that by creating a "reference model", allowing us to name the model and use auto-completion to reference it directly in `schema` by registering the models with `model`.

```typescript twoslash
import { Elysia, t } from 'elysia'

const app = new Elysia()
    .model({
        sign: t.Object({
            username: t.String(),
            password: t.String()
        })
    })
    .post('/sign-in', ({ body }) => body, {
        // with auto-completion for existing model name
        body: 'sign',
        response: 'sign'
    })
```

When we want to access the model's group, we can separate a `model` into a plugin, which when registered will provide a set of models instead of multiple imports.

```typescript
// auth.model.ts
import { Elysia, t } from 'elysia'

export const authModel = new Elysia()
    .model({
        sign: t.Object({
            username: t.String(),
            password: t.String()
        })
    })
```

Then in an instance file:
```typescript twoslash
import { Elysia } from 'elysia'
import { authModel } from './auth.model'

const app = new Elysia()
    .use(authModel)
    .post('/sign-in', ({ body }) => body, {
        // with auto-completion for existing model name
        body: 'sign',
        response: 'sign'
    })
```

This approach not only allows us to separate concerns but also enables us to reuse the model in multiple places while integrating the model into OpenAPI documentation.

### Multiple Models
`model` accepts an object with the key as a model name and the value as the model definition. Multiple models are supported by default.

```typescript
// auth.model.ts
import { Elysia, t } from 'elysia'

export const authModel = new Elysia()
    .model({
        number: t.Number(),
        sign: t.Object({
            username: t.String(),
            password: t.String()
        })
    })
```

### Naming Convention
Duplicate model names will cause Elysia to throw an error. To prevent declaring duplicate model names, we can use the following naming convention.

Let's say that we have all models stored at `models/<name>.ts` and declare the prefix of the model as a namespace.

```typescript
import { Elysia, t } from 'elysia'

// admin.model.ts
export const adminModels = new Elysia()
    .model({
        'admin.auth': t.Object({
            username: t.String(),
            password: t.String()
        })
    })

// user.model.ts
export const userModels = new Elysia()
    .model({
        'user.auth': t.Object({
            username: t.String(),
            password: t.String()
        })
    })
```

This can prevent naming duplication to some extent, but ultimately, it's best to let your team decide on the naming convention.

Elysia provides an opinionated option to help prevent decision fatigue.

### TypeScript
We can get type definitions of every Elysia/TypeBox's type by accessing the `static` property as follows:

```ts twoslash
import { t } from 'elysia'

const MyType = t.Object({
	hello: t.Literal('Elysia')
})

type MyType = typeof MyType.static
````

This allows Elysia to infer and provide type automatically, reducing the need to declare duplicate schema

A single Elysia/TypeBox schema can be used for:
- Runtime validation
- Data coercion
- TypeScript type
- OpenAPI schema

This allows us to make a schema as a **single source of truth**.

## ElysiaJS: TypeBox Validation (Elysia.t)

## Overview

Elysia.t = TypeBox with server-side pre-configuration + HTTP-specific types

**TypeBox API mirrors TypeScript syntax** but provides runtime validation

## Basic Types

| TypeBox | TypeScript | Example Value |
|---------|------------|---------------|
| `t.String()` | `string` | `"hello"` |
| `t.Number()` | `number` | `42` |
| `t.Boolean()` | `boolean` | `true` |
| `t.Array(t.Number())` | `number[]` | `[1, 2, 3]` |
| `t.Object({ x: t.Number() })` | `{ x: number }` | `{ x: 10 }` |
| `t.Null()` | `null` | `null` |
| `t.Literal(42)` | `42` | `42` |

## Attributes (JSON Schema 7)

```ts
// Email format
t.String({ format: 'email' })

// Number constraints
t.Number({ minimum: 10, maximum: 100 })

// Array constraints
t.Array(t.Number(), {
  minItems: 1,  // min items
  maxItems: 5   // max items
})

// Object - allow extra properties
t.Object(
  { x: t.Number() },
  { additionalProperties: true }  // default: false
)
```

## Common Patterns

### Union (Multiple Types)
```ts
t.Union([t.String(), t.Number()])
// type: string | number
// values: "Hello" or 123
```

### Optional (Field Optional)
```ts
t.Object({
  x: t.Number(),
  y: t.Optional(t.Number())  // can be undefined
})
// type: { x: number, y?: number }
// value: { x: 123 } or { x: 123, y: 456 }
```

### Partial (All Fields Optional)
```ts
t.Partial(t.Object({
  x: t.Number(),
  y: t.Number()
}))
// type: { x?: number, y?: number }
// value: {} or { y: 123 } or { x: 1, y: 2 }
```

## Elysia-Specific Types

### UnionEnum (One of Values)
```ts
t.UnionEnum(['rapi', 'anis', 1, true, false])
```

### File (Single File Upload)
```ts
t.File({
  type: 'image',           // or ['image', 'video']
  minSize: '1k',           // 1024 bytes
  maxSize: '5m'            // 5242880 bytes
})
```

**File unit suffixes**:
- `m` = MegaByte (1048576 bytes)
- `k` = KiloByte (1024 bytes)

### Files (Multiple Files)
```ts
t.Files()  // extends File + array
```

### Cookie (Cookie Jar)
```ts
t.Cookie({
  name: t.String()
}, {
  secrets: 'secret-key'  // or ['key1', 'key2'] for rotation
})
```

### Nullable (Allow null)
```ts
t.Nullable(t.String())
// type: string | null
```

### MaybeEmpty (Allow null + undefined)
```ts
t.MaybeEmpty(t.String())
// type: string | null | undefined
```

### Form (FormData Validation)
```ts
t.Form({
  someValue: t.File()
})
// Syntax sugar for t.Object with FormData support
```

### UInt8Array (Buffer → Uint8Array)
```ts
t.UInt8Array()
// For binary file uploads with arrayBuffer parser
```

### ArrayBuffer (Buffer → ArrayBuffer)
```ts
t.ArrayBuffer()
// For binary file uploads with arrayBuffer parser
```

### ObjectString (String → Object)
```ts
t.ObjectString()
// Accepts: '{"x":1}' → parses to { x: 1 }
// Use in: query string, headers, FormData
```

### BooleanString (String → Boolean)
```ts
t.BooleanString()
// Accepts: 'true'/'false' → parses to boolean
// Use in: query string, headers, FormData
```

### Numeric (String/Number → Number)
```ts
t.Numeric()
// Accepts: '123' or 123 → transforms to 123
// Use in: path params, query string
```

## Elysia Behavior Differences from TypeBox

### 1. Optional Behavior

In Elysia, `t.Optional` makes **entire route parameter** optional (not object field):

```ts
.get('/optional', ({ query }) => query, {
  query: t.Optional(  // makes query itself optional
    t.Object({ name: t.String() })
  )
})
```

**Different from TypeBox**: TypeBox uses Optional for object fields only

### 2. Number → Numeric Auto-Conversion

**Route schema only** (not nested objects):

```ts
.get('/:id', ({ id }) => id, {
  params: t.Object({
    id: t.Number()  // ✅ Auto-converts to t.Numeric()
  }),
  body: t.Object({
    id: t.Number()  // ❌ NOT converted (stays t.Number())
  })
})

// Outside route schema
t.Number()  // ❌ NOT converted
```

**Why**: HTTP headers/query/params always strings. Auto-conversion parses numeric strings.

### 3. Boolean → BooleanString Auto-Conversion

Same as Number → Numeric:

```ts
.get('/:active', ({ active }) => active, {
  params: t.Object({
    active: t.Boolean()  // ✅ Auto-converts to t.BooleanString()
  }),
  body: t.Object({
    active: t.Boolean()  // ❌ NOT converted
  })
})
```

## Usage Pattern

```ts
import { Elysia, t } from 'elysia'

new Elysia()
  .post('/', ({ body }) => `Hello ${body}`, {
    body: t.String()  // validates body is string
  })
  .listen(3000)
```

**Validation flow**:
1. Request arrives
2. Schema validates against HTTP body/params/query/headers
3. If valid → handler executes
4. If invalid → Error Life Cycle

## Notes

[Inference] Based on docs:
- TypeBox mirrors TypeScript but adds runtime validation
- Elysia.t extends TypeBox with HTTP-specific types
- Auto-conversion (Number→Numeric, Boolean→BooleanString) only for route schemas
- Use `t.Optional` for optional route params (different from TypeBox behavior)
- File validation supports unit suffixes ('1k', '5m')
- ObjectString/BooleanString for parsing strings in query/headers
- Cookie supports key rotation with array of secrets
