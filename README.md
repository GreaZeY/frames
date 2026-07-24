# Frames

Frames is an experimental, zero-dependency frontend framework built in TypeScript. It uses fine-grained reactivity and direct DOM updates instead of a virtual DOM.

## At a glance

- Zero runtime dependencies
- Fine-grained DOM updates without a virtual DOM
- Tested migration fixture for a routed, async, data-heavy application shell
- JSX compilation through Babel, exposed as a Vite plugin

## What it includes

- Signals, effects, derived state, batching, lifecycle, refs, and cleanup
- A deep proxy store with property-level dependency tracking
- JSX-to-DOM compilation and delegated browser events
- Keyed list reconciliation using the longest increasing subsequence algorithm
- Nested routing, params, redirects, context, and portals
- Lazy modules, suspense and error boundaries, resources, queries, and mutations

## Example

```tsx
import { mount, state } from "frames";

function Counter() {
  const count = state(0);

  return (
    <button onClick={() => count.value++}>Count: {() => count.value}</button>
  );
}

mount(Counter, "#app");
```

## Run locally

```bash
npm install
npm run dev --workspace=demo-app
```

The demo covers signals, derived state, keyed reconciliation, async components, routing, context, portals, and nested reactive stores.

## Tests

```bash
npm test --workspace=packages/frames
```

## Workspace

- `packages/frames`: framework runtime and JSX compiler
- `packages/vite-plugin-frames`: Vite integration
- `examples/demo-app`: interactive feature demo

The runtime size was measured from `packages/frames/src/index.ts` with esbuild minification and gzip compression.
