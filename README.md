# Frames

Frames is an experimental, zero-dependency frontend framework built in TypeScript. It uses fine-grained reactivity and direct DOM updates instead of a virtual DOM.

## At a glance

- Approximately 2.5 kB gzipped for the complete exported runtime
- Zero runtime dependencies
- 45 tests covering reactivity, runtime updates, keyed lists, stores, context, and portals
- JSX compilation through Babel, exposed as a Vite plugin

## What it includes

- Signals, effects, derived state, batching, and effect cleanup
- A deep proxy store with property-level dependency tracking
- JSX-to-DOM compilation and delegated browser events
- Keyed list reconciliation using the longest increasing subsequence algorithm
- Client-side routing, context, portals, and async component support

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
