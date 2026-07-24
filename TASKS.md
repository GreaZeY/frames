# Frames Improvement Roadmap

## P0 - Runtime correctness

- [x] Add owner scopes for effects, cleanups, portals, and reactive branches.
- [x] Make `mount()` return an idempotent unmount function.
- [x] Update same-key list rows without replacing their DOM nodes.
- [x] Share one batched scheduler across signals and stores.
- [x] Guard effects against accidental synchronous recursion.
- [x] Make delegated events expose native `currentTarget` semantics.

## P1 - Async and compiler correctness

- [x] Ignore stale async results after their owner is disposed.
- [x] Support lazy-load errors and retries.
- [x] Preserve context across reactive and lazy execution.
- [x] Support spread, boolean, `aria-*`, `data-*`, style, and SVG JSX props.
- [x] Add compile-and-execute tests for generated JSX.

## P2 - Measured performance

- [x] Update existing text nodes instead of replacing them.
- [x] Add keyed-list prefix and suffix fast paths before LIS reconciliation.
- [x] Cache store proxies and array mutator wrappers with `WeakMap` metadata.
- [x] Validate benchmark DOM output before recording timings.
- [x] Add mount/unmount memory and detached-node regression checks.

## P3 - Production readiness

- [x] Build JavaScript, declarations, and source maps into `dist`.
- [x] Publish explicit package exports and peer dependencies.
- [x] Remove runtime `any` usage from public contracts and internals.
- [x] Require tests, strict TypeScript, package build, and demo build in CI.

## Acceptance criteria

- One hundred mount/unmount cycles retain no active effects or detached nodes.
- Same-key list updates preserve node identity and display current data.
- Mixed signal/store batches execute each dependent effect once.
- Delegated handlers behave like native element handlers.
- A clean external Vite project can install and build Frames.
