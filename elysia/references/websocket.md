# WebSocket

Register `websocket()` from `elysia/websocket` before `.ws()` routes. Use a standard WebSocket client; Socket.IO uses another protocol. Support depends on the [adapter](runtimes.md).

## Typed messages

```ts
import { Elysia, t } from 'elysia'
import { websocket } from 'elysia/websocket'

new Elysia()
	.use(websocket())
	.ws('/chat', {
		query: t.Object({ room: t.String() }),
		body: t.Object({ message: t.String() }),
		response: t.String()
	}, function* ({ query, body }) {
		yield `Room: ${query.room}`
		yield body.message
	})
	.listen(3000)
```

Connect to `ws://localhost:3000/chat?room=general` and send `{"message":"hello"}`. Each yield sends a separate message. Returns and yields preserve inferred response types; `ws.send()` also works.

| Schema | Validates |
| --- | --- |
| `body` | Each incoming message |
| `response` | Returned, yielded, or sent messages |
| `query`, `params`, `headers`, `cookie` | Connection upgrade request |

Default parsing recognizes JSON strings, arrays, objects, booleans, `null`, and safely convertible numeric strings. Other text remains text and binary remains binary.

## Route forms and context

Supported forms are `.ws(path, handler)`, `.ws(path, options, handler)`, and `.ws(path, optionsWithMessage)`. Do not set `options.message` when supplying a separate handler.

Sockets expose `body`, `query`, `params`, and derived values directly. Use `ws.query`, not v1 `ws.data.query`. Members include `send`, `publish`, `subscribe`, `close`, `id`, `remoteAddress`, and `readyState`.

## Lifecycle

| Option | Behavior |
| --- | --- |
| `parse(ws, message)` | Runs after default message parsing and before validation; return a replacement or `undefined` to keep the value |
| `transform` | Runs before validation on upgrade and again for messages |
| `beforeHandle` | Runs on upgrade and before message handlers; return a status to reject the upgrade |
| `upgrade` | Handshake response headers, as an object or function of the upgrade context |
| `open(ws)` | Connection opened |
| `message(ws, message)` | Validated message, also available as `ws.body` |
| `drain(ws)` | Backpressure cleared |
| `close(ws, code, reason)` | Connection closed |

Authentication belongs in `beforeHandle`. Avoid assuming `transform` or `beforeHandle` runs only once per connection. Per-message `parse` is distinct from an HTTP body parser. The v1 `transformMessage` option is replaced by `parse`.

Use this complete callback-form example:

```ts
import { Elysia, t } from 'elysia'
import { websocket } from 'elysia/websocket'

new Elysia()
	.use(websocket())
	.ws('/echo', {
		body: t.String(),
		response: t.String(),
		parse(_ws, message) {
			if (typeof message === 'string') return message.trim()
		},
		message(_ws, message) {
			return message.toUpperCase()
		}
	})
	.listen(3000)
```

## Server configuration

Set server defaults through `websocket({ idleTimeout: 30 })`, not the old constructor `websocket` option. Routes can override WebSocket tuning. Limits and defaults depend on the adapter. Bun options include:

| Option | Meaning |
| --- | --- |
| `perMessageDeflate` | Compression negotiation |
| `maxPayloadLength` | Maximum incoming message bytes |
| `idleTimeout` | Idle timeout in seconds |
| `backpressureLimit` | Maximum buffered bytes per connection |
| `closeOnBackpressureLimit` | Close when that buffer limit is reached |
