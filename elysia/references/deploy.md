# Production builds and deployment

Use this reference for Bun binaries, JavaScript bundles, AOT, containers, and process scaling. See [runtimes.md](runtimes.md) for host entrypoints. Keep installed versions; use [versions.md](versions.md) for new projects.

- [Binary or JavaScript](#binary-or-javascript)
- [AOT build](#aot-build)
- [AOT app exports and side effects](#aot-app-exports-and-side-effects)
- [Containers](#containers)
- [Ports and workers](#ports-and-workers)

## Binary or JavaScript

Build a standalone Bun executable:

```bash
bun build --compile --target bun --minify-whitespace --minify-syntax --outfile server src/index.ts
NODE_ENV=production ./server
```

Build a JavaScript bundle for Bun:

```bash
bun build --target bun --minify-whitespace --minify-syntax --outfile dist/index.js src/index.ts
NODE_ENV=production bun dist/index.js
```

Use the deployment architecture and C library when cross-compiling, for example `--target bun-linux-x64` or `bun-linux-arm64-musl`. Check [Bun's executable targets](https://bun.com/docs/bundler/executables#supported-targets) for the installed Bun version. Check architecture and CPU support before attributing an illegal-instruction failure to your app. A Linux executable may also need `chmod +x server`.

Keep function names for [OpenTelemetry](observability.md). `--minify-whitespace --minify-syntax` preserves them; full `--minify` can change span names. Run the output with its external assets. A successful build does not prove runtime behavior.

## AOT build

AOT generates route handlers and schema validators during the build. A normal bundle still compiles handlers at runtime. AOT imports your entrypoint to discover routes, so it executes module initialization.

Separate app definition from startup. Re-export the app from the build entrypoint for AOT discovery.

```ts
// src/app.ts
import { Elysia, t } from 'elysia'

export const app = new Elysia()
	.get('/hello/:name', {
		params: t.Object({ name: t.String({ minLength: 2 }) })
	}, ({ params }) => `Hello, ${params.name}!`)

export type App = typeof app
```

```ts
// src/index.ts
import { app } from './app'

export { app }
app.listen(3000)
```

```ts
// build.ts
import { aot } from 'elysia/plugin/aot/bun'

const result = await Bun.build({
	entrypoints: ['src/index.ts'],
	outdir: 'dist',
	target: 'bun',
	plugins: [aot('src/index.ts', { target: 'bun' })]
})

if (!result.success) {
	console.error(result.logs)
	process.exit(1)
}

process.exit(0)
```

```bash
bun run build.ts
NODE_ENV=production bun dist/index.js
```

Use the same entry path for the bundler and `aot()`. Set the AOT target to the deployment runtime, even if the build runs on Bun.

| Bundler | Import | Registration |
| --- | --- | --- |
| Bun | `elysia/plugin/aot/bun` | `plugins: [aot(entry, { target })]` |
| esbuild | `elysia/plugin/aot/esbuild` | `plugins: [aot(entry, { target })]` |
| Vite | `elysia/plugin/aot/vite` | Same plugin, with `build.ssr: entry` and `ssr.noExternal: ['elysia']` |
| Rspack | `elysia/plugin/aot/rspack` | Same plugin, with `entry` and the bundler's runtime target |
| Rollup through unplugin | `elysia/plugin/aot/unplugin` | `createUnplugin(aotFactory).rollup({ entry, target })` |

Supported AOT targets are `bun`, `node`, and `workerd`. The [Workers recipe](runtimes.md#cloudflare-workers) includes the complete esbuild configuration. For Node, also configure the [Node adapter](runtimes.md#nodejs). AOT changes code generation, not how the host listens for requests.

AOT trades bundle size for less runtime compilation. Measure the app's startup, memory, and bundle size before claiming an improvement.

### AOT app exports and side effects

The plugin chooses the `app` export first, then the default export, then the sole exported Elysia instance. Re-exports count. Additional instances that build their own routers need unique static names and must also be exported by the entrypoint.

This applies when an instance uses `.handle()`, `.listen()`, `.compile()`, or `.fetch`, including an Elysia sub-app passed to `.mount()`. If more than one app is compiled, name the main app too.

```ts
// src/app.ts
import { Elysia } from 'elysia'

export const sub = new Elysia({ name: 'sub' })
	.get('/', () => 'Sub-app')

export const app = new Elysia({ name: 'main' })
	.mount('/sub', sub.handle)
```

```ts
// src/index.ts
import { app } from './app'

export { app, sub } from './app'
app.listen(3000)
```

An unexported router can build successfully and then fail at runtime with `App "<name>" has no AOT manifest`. Plugins used only through `.use()` need no extra export or name for AOT. Plain fetch handlers, such as Better Auth's `auth.handler`, need no Elysia manifest.

Skip external service initialization during capture without changing route registration:

```ts
import { inAotBuild } from 'elysia'

if (!inAotBuild()) {
	// Connect to external services here.
}
```

Keep route definitions and app names consistent between build and runtime. Do not derive manifest names from environment variables or skip routes during capture. AOT suppresses Elysia's listening during capture, but your own module side effects still run.

### Runtime compilation

Without AOT, Elysia generates handlers with `new Function` when first needed. `new Elysia({ precompile: true })` or `.compile()` moves that work earlier in the current process. Neither replaces an AOT build or removes dynamic code generation.

The v1 option `aot: false` is gone. Use the AOT plugin on runtimes that restrict dynamic code generation. Route and executable schema definitions must be trusted code. `new Function` provides no sandbox.

## Containers

For a compiled Bun server:

```dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
ENV NODE_ENV=production
RUN bun build --compile --minify-whitespace --minify-syntax --outfile server src/index.ts

FROM gcr.io/distroless/base
WORKDIR /app
COPY --from=build /app/server ./server
ENV NODE_ENV=production
EXPOSE 3000
CMD ["./server"]
```

Use a Bun image version matching the project. Copy `tsconfig.json` when aliases or compiler settings affect the build. Ship static files and any other runtime assets explicitly. For a monorepo, build from the repository root and copy each required workspace manifest before dependency installation, then copy the workspace sources.

```bash
docker build -f apps/server/Dockerfile -t elysia-app .
```

Some [OpenTelemetry instrumentations](observability.md) patch packages in `node_modules`. Keep those packages external and ship their production dependencies alongside the executable:

```bash
bun build --compile --external pg --minify-whitespace --minify-syntax --outfile server src/index.ts
bun install --production --frozen-lockfile
```

Put external packages in `dependencies`. Install them into a clean runtime stage to exclude development dependencies.

## Ports and workers

For a platform that supplies `PORT`, bind to all interfaces:

```ts
import { app } from './app'

app.listen({ port: process.env.PORT ?? 3000, hostname: '0.0.0.0' })
```

On Bun and Linux, workers can share a port with `reusePort`. Size the worker count to the deployment's CPU and memory limits, then measure.

```ts
import cluster from 'node:cluster'
import { availableParallelism } from 'node:os'
import { app } from './app'

if (cluster.isPrimary) {
	for (let i = 0; i < availableParallelism(); i++) cluster.fork()
} else {
	app.listen({ port: 3000, reusePort: true })
}
```

On other platforms, use separate ports behind a load balancer or a suitable process manager. Account for each worker's connection pools and in-memory state.
