## Guard

Guard can be used to apply a schema to multiple handlers.

```typescript twoslash
import { Elysia, t } from 'elysia'

new Elysia()
    .get('/none', ({ query }) => 'hi')
                   // ^?

    .guard({ // [!code ++]
        query: t.Object({ // [!code ++]
            name: t.String() // [!code ++]
        }) // [!code ++]
    }) // [!code ++]
    .get('/query', ({ query }) => query)
                    // ^?
    .listen(3000)
```

<br>

This code ensures that the query must have **name** with a string value for every handler after it. The response should be listed as follows:

<Playground
    :elysia="demo1"
    :mock="{
        '/query': {
            GET: 'Elysia'
        }
    }"
/>

The response should be listed as follows:

| Path          | Response |
| ------------- | -------- |
| /none         | hi       |
| /none?name=a  | hi       |
| /query        | error    |
| /query?name=a | a        |

If multiple global schemas are defined for the same property, the latest one will take precedence. If both local and global schemas are defined, the local one will take precedence.

### Guard Schema Type
Guard supports 2 types to define a validation.

### **override (default)**

Override schema if schema is collide with each others.

![Elysia run with default override guard showing schema gets override](/blog/elysia-13/schema-override.webp)

### **standalone** <TutorialBadge href="/tutorial/patterns/standalone-schema" />

Separate collided schema, and runs both independently resulting in both being validated.

![Elysia run with standalone merging multiple guard together](/blog/elysia-13/schema-standalone.webp)

To define schema type of guard with `schema`:
```ts
import { Elysia } from 'elysia'

new Elysia()
	.guard({
		schema: 'standalone', // [!code ++]
		response: t.Object({
			title: t.String()
		})
	})
```
