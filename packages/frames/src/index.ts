declare global {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: Record<string, unknown>;
        }
        type Element = Node;
        interface ElementClass {}
        interface ElementAttributesProperty { props: {}; }
        interface ElementChildrenAttribute { children: {}; }
    }
}

// Frames: Public API
export { state, effect, derived, batch, onCleanup, createRoot } from './reactivity';
export type { Signal } from './reactivity';
export { insert, mount, renderList, getSequence, setProperty, setProperties } from './runtime';
export type { Renderable, SyncRenderable } from './runtime';
export { delegateEvent } from './events';
export { Route, Link, navigate, currentPath } from './router';
export { createContext, useContext } from './context';
export { Portal } from './portal';
export type { Context } from './context';
export { store, unwrap } from './store';
export { lazy } from './lazy';
