# Versions and verification

## Select a version

- Read the manifest and lockfile. Keep the project's package manager, resolved versions, runtime, and TypeScript settings.
- These references describe v2. Do not apply v2 signatures to v1 or upgrade an existing project without a migration request.
- For another beta, check its installed exports and types. Prefer that release's source and tests over conflicting docs.
- For a new project at this baseline, pin the versions below. Avoid `@next` in a reproducible setup. Plugin beta numbers are independent of the framework's beta number.
- Enable TypeScript `strict`. With Eden, resolve the same `elysia` version on the client and server.

## Baseline

Reviewed on 2026-10-17 against the local Elysia checkout declaring `2.0.0-beta.32`. Its base commit is `c91f61f245d2c381946ac198ca6a2f393bc8af99` in `elysiajs/elysia`, with uncommitted source changes present. The commit alone does not reproduce the reviewed working tree; an installed or published package may differ.

This review used source, tests, and v2 docs under `interdoc/src/content`. Using the skill requires neither sibling checkout.

These versions come from local repositories. They do not prove release availability or end-to-end integration compatibility. Before installing, check availability and peer requirements.

| Package | Baseline |
| --- | --- |
| `elysia` | `2.0.0-beta.32` |
| `@elysia/eden` | `2.0.0-beta.7` |
| `@elysia/openapi` | `2.0.0-beta.6` |
| `@elysia/node` | `2.0.0-beta.3` |
| `@elysia/static` | `2.0.0-beta.3` |
| `@elysia/cors` | `2.0.0-beta.2` |
| `@elysia/opentelemetry` | `2.0.0-beta.2` |
| `@elysia/bearer`, `@elysia/cron`, `@elysia/apollo`, `@elysia/graphql-yoga`, `@elysia/html`, `@elysia/jwt`, `@elysia/server-timing` | `2.0.0-beta.1` |

Install only what the task needs. New plugin packages use `@elysia/*`. Check peer requirements before mixing releases. Baseline cron requires Elysia beta.32 or newer; CORS, static, OpenTelemetry, and server-timing require at least beta.30.

## Peer dependencies

Elysia v2 uses `typebox` 1.x, not `@sinclair/typebox` 0.x. Baseline peers include `typebox >= 1.3.0`, `exact-mirror >= 1.2.6`, and `openapi-types >= 12.0.0`. Install these explicitly if automatic peer installation is disabled. TypeScript must be at least 5.7; Bun types must be at least 1.3 when used.

For a new Bun project at this baseline:

```sh
bun add elysia@2.0.0-beta.32
bun add -d typescript @types/bun
```

Commit the lockfile. See [runtimes](runtimes.md) for entrypoints and scripts.

## Evidence and limits

Core guidance follows source signatures, implementation, and focused regression tests. Executable checks cover the minimal route, type preservation, and selected lifecycle and error behavior. They do not verify every third-party version or host.

Integration references list adapters and known constraints. Check installed exports and test the integration before shipping. Renaming imports does not make v1 schema adapters v2-compatible.

Update the baseline and install commands together. Re-run [testing checks](testing.md) when signatures or examples change.
