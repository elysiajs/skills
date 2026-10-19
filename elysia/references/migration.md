# Recognizing and migrating older Elysia APIs

Migrate only when requested. Otherwise, keep the project's version and conventions. See [versions.md](versions.md) for the source baseline and compatibility policy.

## v1 patterns and current v2 forms

| Older pattern | Current v2 form |
| --- | --- |
| `.get(path, handler, options)` | `.get(path, options, handler)`. |
| `.onBeforeHandle({ as: 'global' }, fn)` | `.onBeforeHandle('global', fn)`. The object form warns. |
| Scope `'scoped'` | `'plugin'`. The old string throws. Other scopes are `'local'` and `'global'`. |
| `.resolve(fn)` | `.derive(fn)`, in the before-handle queue after validation. |
| Macro `resolve` | Macro `derive`. |
| `.macro(name, definition)` | `.macro({ name: definition })`. |
| `response` in response hooks | `responseValue`. |
| Guard schemas implicitly merge with route schemas | Route schemas override the corresponding guard schema. Add `schema: 'merge'` to the guard to require both. |
| `app.store` | Read `store` from request context. |
| Constructor `websocket` | `.use(websocket(options))` from `elysia/websocket`. |
| `ws.data.query` | `ws.query`, with context on the socket. |
| WebSocket `transformMessage` | WebSocket `parse`. |
| Cookie `.add(options)` | `.update(options)`. |
| `delete cookie.name` | `cookie.name.remove()`. |
| `.route(method, path, handler)` | `.method(method, path, options?, handler)`. |
| Constructor `aot` | `precompile: true` for startup compilation. Build-time AOT uses `elysia/plugin/aot/*`. |
| Constructor `systemRouter` | `nativeStaticResponse`, default `true`, controls eligible native static responses. |
| `elysia/adapter/cloudflare-worker` | AOT esbuild plugin with `target: 'workerd'`, then `app.handle`. See [runtimes.md](runtimes.md). |
| `@sinclair/typebox` schemas | `typebox` 1.x through Elysia's `t` or a supported Standard Schema validator. Do not mix incompatible TypeBox generations. |
| `t.Transform` | `t.Codec`. `t.Recursive`, `t.Not`, and `t.RegExp` are no longer exported. |
| Schema `.static` assumptions | `UnwrapSchema<typeof Schema>` and `UnwrapModels<typeof Models>`. |
| Swagger plugin | `@elysia/openapi`. |

## Beta documentation differences

Older beta docs may describe removed APIs. At the [verified baseline](versions.md):

- Lifecycle registration methods use `onRequest`, `onParse`, `onTransform`, `onBeforeHandle`, `onAfterHandle`, `onAfterResponse`, and `onError`. `derive`, `mapResponse`, and `trace` keep their bare names. Startup and shutdown hooks are `onStart` and `onStop`.
- `app.handle('/path', init?)` accepts a path and `RequestInit` in addition to a `Request`.
- `.query()` registers the HTTP `QUERY` verb.
- `abortSignal` defaults to `true`, with cancellation checks between lifecycle stages.
- `context.route` can be undefined for static routes. Use `context.path` for the actual pathname.
- Static-value handlers can retain precomputed headers over hook writes. Use function handlers for dynamic response headers.
- `t.UnionEnum` does not default to its first entry. A missing required field fails validation.
- Production redaction depends on the error type and explicit fields. Some 5xx messages and details remain public. See [errors.md](errors.md).
- Node's minimum engine version is `22.18` for this baseline.

Removed subpaths include `elysia/type-system`, `elysia/cookies`, `elysia/parse-query`, `elysia/sucrose`, `elysia/universal/env`, `elysia/universal/server`, and `elysia/adapter/web-standard/handler`. Removed exports include `parseQuery`, `serializeCookie`, `signCookie`, standalone `mapResponse`, `errorToResponse`, and the `Cookie` class value. The instance's `.mapResponse()` method remains supported.

AOT artifacts must match the runtime and route definitions. A changed route falls back to runtime compilation with a warning, or fails with 500 if the build stripped the JIT compiler. Change conditional hook lists, such as `isProd ? [auth] : []`, rather than substituting another function at the same position. Baseline manifest format 7 rejects older artifacts with a fingerprint mismatch. Rebuild instead of reusing them. See [runtimes.md](runtimes.md) for the build recipe.
