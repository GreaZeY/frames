# Frames

Frames is a ultra-lightweight, high-performance UI library that compiles JSX directly into fine-grained DOM operations. Unlike React, Frames eliminates the Virtual DOM entirely. Components in Frames execute exactly once during setup, and signals update DOM nodes directly with minimal overhead.

## Table of Contents
- [Philosophy](#philosophy)
- [Installation](#installation)
- [Quick Example](#quick-example)
- [Reactivity API](#reactivity-api)
  - [state](#state)
  - [derived](#derived)
  - [effect](#effect)
  - [batch](#batch)
  - [onCleanup](#oncleanup)
- [Deep Proxy Store](#deep-proxy-store)
- [Runtime & Rendering](#runtime--rendering)
  - [mount](#mount)
  - [insert](#insert)
  - [renderList](#renderlist)
  - [lazy](#lazy)
- [Routing](#routing)
- [Context API](#context-api)
- [Portals](#portals)
- [Event Delegation](#event-delegation)
- [Compiler & Vite Plugin](#compiler--vite-plugin)
- [Comparison with React](#comparison-with-react)

---

## Philosophy

Most modern web applications spend significant CPU cycles building, diffing, and tearing down Virtual DOM trees. When a single value changes in React, the entire component function re-executes.

Frames takes a fundamentally different path:
1. **No Virtual DOM**: Components return native DOM nodes.
2. **Execute Once**: Component functions setup state and DOM structure once. They never re-run on state changes.
3. **Fine-Grained Updates**: Reactivity is bound directly to individual DOM text nodes and element properties. Updating a signal updates only the specific node in the DOM.
4. **Zero Hook Rules**: Signals can be declared inside loops, conditionals, or nested helper functions without restrictions.

---

## Installation

Frames works as a monorepo package or via npm inside Vite projects.

```bash
npm install frames
npm install --save-dev vite-plugin-frames
```

In your `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import framesPlugin from 'vite-plugin-frames';

export default defineConfig({
    plugins: [framesPlugin()]
});
```

---

## Quick Example

```tsx
import { state, derived, mount } from 'frames';

function Counter() {
    const count = state(0);
    const doubled = derived(() => count.value * 2);

    return (
        <div class="counter-card">
            <h1>Count: {() => count.value}</h1>
            <p>Doubled: {() => doubled.value}</p>
            <button onClick={() => count.value++}>Increment</button>
            <button onClick={() => count.value--}>Decrement</button>
        </div>
    );
}

mount(Counter, '#app');
```

---

## Reactivity API

### `state`

Creates a reactive signal holding a value. Reading `.value` inside an effect or JSX binding automatically registers dependency tracking.

```ts
import { state } from 'frames';

const count = state(0);
console.log(count.value); // 0

count.value = 1; // Triggers subscribers
```

### `derived`

Creates a memoized, read-only computed value. It evaluates lazily when accessed and re-computes only when its underlying dependencies change.

```ts
import { state, derived } from 'frames';

const firstName = state('Alice');
const lastName = state('Smith');

const fullName = derived(() => `${firstName.value} ${lastName.value}`);
console.log(fullName.value); // "Alice Smith"
```

### `effect`

Runs a side effect immediately, tracking any signals accessed during execution. Automatically re-executes whenever any tracked dependency mutates. Returns a disposal function.

```ts
import { state, effect } from 'frames';

const count = state(0);

const stop = effect(() => {
    console.log('Current count:', count.value);
});

count.value = 5; // Logs: "Current count: 5"
stop(); // Disposes the effect
```

### `batch`

Defers subscriber notifications across multiple signal writes until the batch block finishes.

```ts
import { state, batch } from 'frames';

const first = state('a');
const second = state('b');

batch(() => {
    first.value = 'x';
    second.value = 'y';
}); // Subscribers fire once here
```

### `onCleanup`

Registers a teardown callback inside the current reactive effect. Executes immediately before the effect re-runs or when it is disposed.

```ts
import { effect, onCleanup } from 'frames';

effect(() => {
    const timer = setInterval(() => console.log('tick'), 1000);
    onCleanup(() => clearInterval(timer));
});
```

---

## Deep Proxy Store

`store` wraps plain objects and arrays in a deeply nested Proxy. Reading any nested property registers a granular subscriber for that exact key path.

```ts
import { store, effect } from 'frames';

const user = store({
    profile: {
        name: 'Alex',
        theme: 'dark'
    },
    items: ['a', 'b']
});

// Only re-runs when user.profile.name changes
effect(() => {
    console.log('Name:', user.profile.name);
});

user.profile.name = 'Jordan'; // Triggers effect
user.profile.theme = 'light'; // Does NOT trigger effect above
```

Use `unwrap(proxy)` to retrieve the raw underlying JavaScript object.

---

## Runtime & Rendering

### `mount`

Attaches a root component to a target container selector or DOM element.

```ts
import { mount } from 'frames';
import App from './App';

mount(App, '#app');
```

### `insert`

Internal and public DOM insertion utility. Accepts raw DOM nodes, strings, signals, arrays, Promises (for async components), and functions.

```ts
import { insert } from 'frames';

const container = document.createElement('div');
insert(container, () => count.value);
```

### `renderList`

Keyed array diffing powered by the Longest Increasing Subsequence (LIS) algorithm. Reuses existing DOM nodes and minimizes DOM moves.

```ts
import { state, renderList } from 'frames';

const items = state([
    { id: 1, text: 'First' },
    { id: 2, text: 'Second' }
]);

renderList(
    container,
    () => items.value,
    item => item.id,
    item => {
        const div = document.createElement('div');
        div.textContent = item.text;
        return div;
    }
);
```

### `lazy`

Defers component dynamic imports until rendered. Automatically integrates with async resolution in `insert()`.

```ts
import { lazy } from 'frames';

const HeavyChart = lazy(() => import('./HeavyChart'));

// Usage in JSX:
<HeavyChart data={data} />
```

---

## Routing

Client-side HTML5 history router with reactive path binding.

```tsx
import { Route, Link, navigate, currentPath } from 'frames';

function App() {
    return (
        <div>
            <nav>
                <Link to="/">Home</Link>
                <Link to="/about">About</Link>
            </nav>

            <Route path="/">
                <HomePage />
            </Route>

            <Route path="/about">
                <AboutPage />
            </Route>
        </div>
    );
}
```

Use `navigate('/path')` for programmatic navigation, or read `currentPath.value` directly.

---

## Context API

Provides tree-based dependency injection across components without prop drilling.

```tsx
import { createContext, useContext, state } from 'frames';

const ThemeContext = createContext(state('dark'));

function Parent() {
    const theme = state('dark');
    return (
        <ThemeContext.Provider value={theme}>
            <Child />
        </ThemeContext.Provider>
    );
}

function Child() {
    const theme = useContext(ThemeContext)!;
    return <button onClick={() => theme.value = 'light'}>Mode: {() => theme.value}</button>;
}
```

---

## Portals

Renders children into another location in the DOM (defaults to `document.body`) while maintaining the original component reactive scope and lifecycle.

```tsx
import { Portal } from 'frames';

function Modal({ isOpen, onClose }) {
    return (
        <>
            {() => isOpen.value ? (
                <Portal>
                    <div class="modal-backdrop" onClick={onClose}>
                        <div class="modal-card">
                            <h2>Modal Title</h2>
                            <button onClick={onClose}>Close</button>
                        </div>
                    </div>
                </Portal>
            ) : null}
        </>
    );
}
```

---

## Event Delegation

Frames uses document-level event delegation for all standard bubbling events (`onClick`, `onInput`, `onKeyDown`, etc.). 

- Handlers are assigned directly to elements via internal property slots (`_el.$$click = handler`).
- The runtime attaches a single event listener to `document` per event type.
- Non-bubbling events (`onMouseEnter`, `onScroll`, `onFocus`, etc.) fallback to direct `addEventListener`.

---

## Compiler & Vite Plugin

The custom Babel compiler (`babel-plugin.ts`) transforms JSX into sequence expressions using native DOM methods:

Input:
```tsx
<button class="btn" onClick={handleClick}>
    Count: {() => count.value}
</button>
```

Compiled Output:
```js
var _el;
(
    _el = document.createElement("button"),
    _el.className = "btn",
    _el.$$click = handleClick,
    _delegateEvent("click"),
    _insert(_el, () => count.value),
    _el
)
```

Key compiler optimizations:
- **Sequence Expressions**: Avoids IIFE closures for element creation.
- **Direct Properties**: Maps known DOM attributes (`id`, `className`, `value`, `disabled`) to direct property assignments instead of `setAttribute`.
- **Lazy Children**: Component children are wrapped in getter functions `() => ...` to prevent premature execution.

---

## Comparison with React

| Feature | React | Frames |
| :--- | :--- | :--- |
| **Rendering Strategy** | Virtual DOM reconciliation | Fine-grained signals + direct DOM updates |
| **Component Lifetime** | Re-executes on every render | Executes once during setup |
| **State Primitives** | `useState`, `useMemo`, `useCallback` | `state`, `derived`, `store` |
| **Rules of Hooks** | Strict top-level ordering rules | No rules; signals can live anywhere |
| **List Diffing** | Full VNode comparison | LIS keyed reconciliation |
| **Memory Allocation** | Allocates VNode trees per frame | Zero VNode allocations |
| **Async Components** | React.lazy + Suspense boundaries | Native Promise support + `lazy()` |
