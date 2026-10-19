# AI SDK

Use the project's `ai` and provider packages, such as `@ai-sdk/openai`. Check their versions before choosing stream methods. Elysia accepts a `ReadableStream` or Web `Response` directly.

## Choose the client protocol

| Client | Return from the route |
| --- | --- |
| Plain text stream | `result.textStream` |
| Eden with typed SSE chunks | `sse(result.textStream)` |
| AI SDK UI client | `result.toUIMessageStreamResponse()` |
| Plain text `Response` | `result.toTextStreamResponse()` |

The SDK's UI response helper sets the protocol headers. Custom SSE alone does not reproduce that protocol. Returning a `Response` loses Eden's inferred stream item type. See [Eden](eden.md).

```ts
import { Elysia, t } from 'elysia'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

const model = process.env.OPENAI_MODEL
if (!model) throw new Error('OPENAI_MODEL is required')

export const app = new Elysia().post('/generate', {
	body: t.Object({ prompt: t.String({ minLength: 1 }) })
}, ({ body, request }) => {
	const result = streamText({
		model: openai(model),
		prompt: body.prompt,
		abortSignal: request.signal
	})

	return result.toTextStreamResponse()
})
```

Configure provider credentials and use the project's configured model.

## Emit custom events

Use a generator for named SSE events. This example reuses the `model` and provider imports above.

```ts
import { Elysia, sse } from 'elysia'

new Elysia().get('/events', async function* ({ request }) {
	const result = streamText({
		model: openai(model),
		prompt: 'Hello',
		abortSignal: request.signal
	})

	for await (const data of result.textStream)
		yield sse({ event: 'message', data })

	yield sse({ event: 'done' })
})
```

For an unsupported provider, return the `Response` from a server-side `fetch()` to its streaming endpoint. Preserve its headers and pass the request's abort signal.
