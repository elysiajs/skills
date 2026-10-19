# Runtimes and framework integration

Choose the host's entrypoint below. See [versions.md](versions.md) for packages and peers; keep existing project versions. See [deploy.md](deploy.md) for builds and containers.

- [Bun](#bun), [Node.js](#nodejs), [Deno](#deno)
- [Cloudflare Workers](#cloudflare-workers), [Vercel](#vercel), [Netlify Edge](#netlify-edge)
- [Next.js](#nextjs), [Nuxt](#nuxt), [Astro](#astro), [SvelteKit](#sveltekit), [Expo](#expo), [TanStack Start](#tanstack-start)

## Host contract

| Host owns | Elysia entrypoint |
| --- | --- |
| Standalone Bun server | `app.listen(port)` |
| Standalone Node server | `new Elysia({ adapter: node() }).listen(port)` |
| Fetch-compatible server or route export | `app.fetch` |
| Host callback with a request argument | `(request) => app.handle(request)` |

`fetch` and `handle` accept a Web Standard `Request`. Await their `Response`. Do not call `.listen()` when the host owns the server. Keep `strict: true` for type inference.

Use `.mount('/prefix', handler)` for fetch-compatible apps. Use `.use()` for Elysia instances to preserve types and hook scope. See [composition.md](composition.md).

These v2 documentation recipes are not verified deployments for your account or framework version. Check installed APIs and run the host's local server before deploying.

## Bun

```ts
// src/index.ts
import { Elysia } from 'elysia'

new Elysia()
	.get('/', () => 'Hello Elysia')
	.listen(3000)
```

```bash
bun --watch src/index.ts
```

For reusable apps, put the definition and `export type App = typeof app` in `src/app.ts`. Import it into `src/index.ts` and call `.listen()`. See [project-structure.md](project-structure.md). Check generator output; its version does not identify the installed Elysia version.

Bun-specific capabilities include `server.requestIP(request)`, native static responses, TLS, and `reusePort`. Do not assume these exist on a fetch-only host.

### Bun fullstack

Bun 1.3+ can bundle HTML and serve frontend HMR alongside Elysia through `@elysia/static`:

```ts
import { Elysia } from 'elysia'
import { staticPlugin } from '@elysia/static'

new Elysia()
	.use(await staticPlugin({ prefix: '/', bunFullstack: true }))
	.listen(3000)
```

Put `index.html` in `public/` and reference frontend modules from it. `bunFullstack: true` enables bundling; awaiting the plugin alone does not. The default prefix is `/public`. See [versions.md](versions.md) for compatible packages.

For React, use `jsx: 'react-jsx'` in `tsconfig.json`. Bun resolves that file's path aliases. For Tailwind 4, install `bun-plugin-tailwind` and add:

```toml
# bunfig.toml
[serve.static]
plugins = ["bun-plugin-tailwind"]
```

Import `tailwindcss` in a stylesheet referenced by the HTML or frontend module. Ship `public/` with the production server and test the production build, not only HMR. See [static plugin](plugins.md) and the [fullstack example](https://github.com/saltyaom/elysia-fullstack-example).

## Node.js

The baseline needs Node 22.18+ and `@elysia/node` from [versions.md](versions.md). Apply the adapter to the main instance:

```ts
import { Elysia } from 'elysia'
import { node } from '@elysia/node'

new Elysia({ adapter: node() })
	.get('/', () => 'Hello Elysia')
	.listen(3000)
```

For ESM TypeScript, set `type: 'module'` in `package.json`. Use `tsx watch src/index.ts` for development, `tsc -p tsconfig.json` to build, and `node dist/index.js` to run. Include `@types/node` and these settings:

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "NodeNext",
		"moduleResolution": "NodeNext",
		"lib": ["ESNext", "DOM", "DOM.Iterable"],
		"types": ["node"],
		"rootDir": "src",
		"outDir": "dist",
		"strict": true,
		"skipLibCheck": true
	},
	"include": ["src/**/*.ts"]
}
```

Under `NodeNext`, use `.js` extensions for relative imports in TypeScript source. Plain JavaScript uses the same adapter with `node --watch src/index.js`. Set `NODE_ENV=production` in the deployment environment.

## Deno

Add the selected Elysia release through Deno's npm compatibility, then let Deno own the server:

```bash
deno add npm:elysia@2.0.0-beta.32
deno run --allow-net --watch src/index.ts
```

```ts
import { Elysia } from 'elysia'

const app = new Elysia().get('/', () => 'Hello Elysia')
Deno.serve({ port: 8787 }, app.fetch)
```

## Cloudflare Workers

Use the AOT plugin with `target: 'workerd'`. The v1 Cloudflare adapter export and `aot: false` constructor option do not exist in v2. `.compile()` does not replace this build step.

```ts
// src/index.ts
import { Elysia } from 'elysia'

export const app = new Elysia()
	.get('/', () => 'Hello Worker')

export default {
	fetch: (request: Request) => app.handle(request)
}
```

Install `esbuild` as a development dependency and build with:

```ts
// build.ts
import * as esbuild from 'esbuild'
import { aot } from 'elysia/plugin/aot/esbuild'

await esbuild.build({
	entryPoints: ['src/index.ts'],
	bundle: true,
	format: 'esm',
	outfile: 'dist/worker.js',
	conditions: ['workerd', 'worker', 'browser', 'import'],
	platform: 'browser',
	target: 'esnext',
	external: ['node:*', 'cloudflare:*'],
	plugins: [aot('src/index.ts', { target: 'workerd' })]
})
```

The v2 integration recipe uses this Wrangler configuration:

```jsonc
// wrangler.jsonc
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "elysia-worker",
	"main": "dist/worker.js",
	"compatibility_date": "2025-09-06",
	"compatibility_flags": ["nodejs_compat"],
	"build": { "command": "bun build.ts" }
}
```

Verify with `wrangler dev`. Match compatibility settings to dependencies. This recipe is unverified against your Cloudflare account.

Configure bindings in Wrangler and generate types with `wrangler types`. Import `env` inside the handler; top-level Worker-only imports can break AOT capture.

```ts
.get('/kv', async () => {
	const { env } = await import('cloudflare:workers')
	return await env.KV.get('my-key')
})
```

Worker constraints:

- Use function handlers so response creation happens during a request.
- Keep runtime-only initialization inside handlers. AOT executes module initialization on the build machine.
- Publish files with [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), for example `assets: { directory: 'public' }` in Wrangler. Do not assume `file()` or a filesystem static plugin can read your development files.
- Generate [OpenAPI](openapi.md) type information during the build. Deployed Workers cannot inspect unbundled TypeScript sources.

## Vercel

The v2 integration recipe default-exports the instance from `src/index.ts`:

```ts
import { Elysia } from 'elysia'

export default new Elysia().get('/', () => 'Hello Vercel')
```

Use `type: 'module'` in `package.json` for Node. To select Bun, set `bunVersion: '1.x'` in `vercel.json`. Run `vc dev` to check the integration. Check [Vercel's Elysia support](https://vercel.com/docs/frameworks/backend/elysia) when the installed platform behavior differs.

## Netlify Edge

Netlify Edge owns the Deno server. Configure the function path explicitly:

```ts
// netlify/edge-functions/hello.ts
import { Elysia } from 'elysia'

export const config = { path: '/hello' }
const app = new Elysia({ prefix: '/hello' })
	.get('/', () => 'Hello Elysia')

export default (request: Request) => app.handle(request)
```

Verify with `netlify dev`. File location alone does not select the URL. See [Netlify Edge Functions](https://docs.netlify.com/build/edge-functions/overview/).

## Framework routes

Match `prefix` to the host's mount. The forwarded URL includes that prefix. Export each required HTTP method or the host's fallback handler.

Keep runtime imports of the server out of browser code. Use `import type { App }` for browser [Eden clients](eden.md). A server-only client can use `treaty(app)` without HTTP.

### Next.js

```ts
// app/api/[[...slugs]]/route.ts
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/api' })
	.get('/', () => 'Hello Next.js')

export const GET = app.fetch
export type App = typeof app
```

For a shared instance, move it to `lib/server.ts` and import it into the route. Put `treaty(app).api` in a module that imports `server-only`. Put `treaty<App>(origin).api` in the browser client with a type-only server import. Use the deployed origin in production. See [Next.js route handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers).

### Nuxt

The community [nuxt-elysia module](https://github.com/tkesgar/nuxt-elysia) provides this integration. Check Elysia version support before installing:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['nuxt-elysia'],
	nitro: { preset: 'bun' },
	nuxtElysia: { path: '/api' }
})
```

```ts
// api.ts at the project root
import { Elysia } from 'elysia'

export default () => new Elysia()
	.get('/hello', () => ({ message: 'Hello' }))
```

The module supplies `useNuxtApp().$api` and mounts at `/_api` by default. The Bun preset is recommended, not required by Elysia. Check module support for other presets.

### Astro

Use `output: 'server'` and an Astro adapter for the deployment host:

```ts
// src/pages/api/[...slugs].ts
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/api' })
	.get('/', () => 'Hello Astro')

export const GET = ({ request }: { request: Request }) => app.handle(request)
```

Add matching exports for other methods. See [Astro endpoints](https://docs.astro.build/en/core-concepts/endpoints/).

### SvelteKit

```ts
// src/routes/api/[...slugs]/+server.ts
import { Elysia } from 'elysia'
import type { RequestHandler } from './$types'

const app = new Elysia({ prefix: '/api' })
	.get('/', () => 'Hello SvelteKit')

export const fallback: RequestHandler = ({ request }) => app.handle(request)
```

See [SvelteKit server routing](https://svelte.dev/docs/kit/routing#server).

### Expo

Use an Expo Router API route, available since SDK 50:

```ts
// app/api/[...slugs]+api.ts
import { Elysia } from 'elysia'

const app = new Elysia({ prefix: '/api' })
	.get('/', () => 'Hello Expo')

export const GET = app.fetch
export type App = typeof app
```

Use an origin reachable by the device, such as your development machine's LAN address. Use the deployed origin in production. Functions from `expo export` still need a supported host adapter. See [Expo API route deployment](https://docs.expo.dev/router/reference/api-routes/#deployment).

### TanStack Start

```ts
// src/routes/api.$.ts
import { Elysia } from 'elysia'
import { createFileRoute } from '@tanstack/react-router'

const app = new Elysia({ prefix: '/api' })
	.get('/', () => 'Hello TanStack Start')

export const Route = createFileRoute('/api/$')({
	server: {
		handlers: {
			GET: ({ request }) => app.fetch(request)
		}
	}
})
```

To call from loaders on both server and browser, use `createIsomorphicFn` from `@tanstack/react-start`. Its server branch returns `treaty(app).api`, and its client branch returns `treaty<typeof app>(origin).api`. Keep the server instance in the server branch and verify it is excluded from the client bundle. See [TanStack Start](https://tanstack.com/start).
