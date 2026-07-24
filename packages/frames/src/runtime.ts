import {
    _captureScope,
    _handleScopeError,
    _isScopeActive,
    _registerSuspense,
    _runInScope,
    createRoot,
    effect,
    onCleanup,
    state,
} from './reactivity';
import type { Signal } from './reactivity';
import { bindEvent, isDelegatedEvent } from './events';

const spreadKeys = new WeakMap<Element, Set<string>>();

export type Ref<T> = ((value: T | null) => void) | { current: T | null } | null | undefined;

function writeRef<T>(ref: Ref<T>, value: T | null) {
    if (typeof ref === 'function') ref(value);
    else if (ref) ref.current = value;
}

export function bindRef<T extends Node>(node: T, getRef: () => Ref<T>) {
    let current: Ref<T>;
    effect(() => {
        const next = getRef();
        if (next === current) return;
        writeRef(current, null);
        current = next;
        writeRef(current, node);
    });
    onCleanup(() => writeRef(current, null));
}

export type SyncRenderable =
    | Node
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | Renderable[]
    | (() => Renderable);

export type Renderable = SyncRenderable | Promise<SyncRenderable>;

interface InsertedGroup {
    nodes: Node[];
}

type Inserted = Node | Node[] | InsertedGroup | null;

export function setProperty(element: Element, name: string, value: unknown) {
    if (name === 'style' && value && typeof value === 'object') {
        const style = (element as HTMLElement | SVGElement).style;
        style.cssText = '';
        for (const [key, styleValue] of Object.entries(value)) {
            if (styleValue == null) continue;
            if (key.startsWith('--') || key.includes('-')) {
                style.setProperty(key, String(styleValue));
            } else {
                style.setProperty(key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), String(styleValue));
            }
        }
        return;
    }

    const prop = name === 'class' ? 'className' : name === 'for' ? 'htmlFor' : name;
    const isSvg = element.namespaceURI === 'http://www.w3.org/2000/svg';
    const useAttribute = isSvg || name.startsWith('aria-') || name.startsWith('data-') || !(prop in element);

    if (useAttribute) {
        const attribute = isSvg && !['viewBox', 'preserveAspectRatio'].includes(name)
            ? name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace('class-name', 'class')
            : name;
        if (value == null || value === false) element.removeAttribute(attribute);
        else element.setAttribute(attribute, value === true ? '' : String(value));
        return;
    }

    const target = element as unknown as Record<string, unknown>;
    if (value == null) {
        if (typeof target[prop] === 'boolean') target[prop] = false;
        else if (prop === 'value' || prop === 'textContent') target[prop] = '';
        else element.removeAttribute(prop === 'className' ? 'class' : prop === 'htmlFor' ? 'for' : name);
        return;
    }
    if (!Object.is(target[prop], value)) target[prop] = value;
}

export function setProperties(element: Element, props: Record<string, unknown>) {
    const previous = spreadKeys.get(element);
    if (previous) {
        for (const name of previous) {
            if (!(name in props)) setProperty(element, name, undefined);
        }
    }

    const next = new Set(Object.keys(props));
    spreadKeys.set(element, next);
    for (const name of next) {
        if (name === 'ref') {
            bindRef(element, () => props[name] as Ref<Element>);
        } else if (/^on[A-Z]/.test(name)) {
            const eventName = name.slice(2).toLowerCase();
            bindEvent(
                element,
                eventName,
                () => props[name] as ((event: Event) => void) | undefined,
                isDelegatedEvent(eventName),
            );
        } else {
            setProperty(element, name, props[name]);
        }
    }
}

// ─── DOM Insertion ───────────────────────────────────────────────────────────

export function insert(parent: Node, child: Renderable, anchor: Node | null = null, current?: Inserted): Inserted {
    if (typeof child === 'function') {
        effect(() => {
            current = insert(parent, child(), anchor, current);
        });
        return current ?? null;
    }

    if ((typeof child === 'string' || typeof child === 'number' || typeof child === 'bigint') && current instanceof Text) {
        const value = String(child);
        if (current.data !== value) current.data = value;
        return current;
    }

    if (child === current) return current ?? null;

    // Cleanup previous nodes
    if (current != null) {
        let toRemove: Node[] = [];
        if (Array.isArray(current)) {
            toRemove = current;
        } else if (current instanceof Node) {
            toRemove = [current];
        } else if ('nodes' in current) {
            toRemove = current.nodes;
        }

        for (let i = 0; i < toRemove.length; i++) {
            const c = toRemove[i];
            if (c instanceof Node && c.parentNode) {
                c.parentNode.removeChild(c);
            }
        }
    }

    if (child == null || typeof child === 'boolean') {
        return null;
    }

    if (child instanceof Promise) {
        const placeholder = document.createComment("async");
        parent.insertBefore(placeholder, anchor);
        const ref: InsertedGroup = { nodes: [placeholder] };
        const scope = _captureScope();
        _registerSuspense(scope, child);
        let active = true;

        onCleanup(() => {
            active = false;
            placeholder.remove();
        });

        child.then(resolvedChild => {
            if (active && _isScopeActive(scope) && placeholder.parentNode) {
                const res = _runInScope(scope, () =>
                    insert(parent, resolvedChild, anchor, placeholder)
                );
                if (Array.isArray(res)) {
                    ref.nodes = res;
                } else if (res instanceof Node) {
                    ref.nodes = [res];
                } else if (res !== null) {
                    ref.nodes = res.nodes;
                }
            }
        }, error => {
            if (active) placeholder.remove();
            _handleScopeError(scope, error);
        });
        return ref;
    }

    if (Array.isArray(child)) {
        const nodes: Node[] = [];
        for (let i = 0; i < child.length; i++) {
            const inserted = insert(parent, child[i], anchor);
            if (Array.isArray(inserted)) {
                for (let j = 0; j < inserted.length; j++) nodes.push(inserted[j]);
            } else if (inserted instanceof Node) {
                nodes.push(inserted);
            } else if (inserted !== null) {
                nodes.push(...inserted.nodes);
            }
        }
        return nodes;
    }

    let node: Node;
    if (child instanceof Node) {
        node = child;
    } else {
        node = document.createTextNode(String(child));
    }

    parent.insertBefore(node, anchor);
    return node;
}

// ─── Longest Increasing Subsequence ──────────────────────────────────────────

export function getSequence(arr: number[]): number[] {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;

    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = (u + v) >> 1;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                } else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }

    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

// ─── Keyed List Reconciliation ───────────────────────────────────────────────

interface MappedItem<T> {
    node: Node;
    dispose: () => void;
    source: Signal<T> | null;
    value: T;
}

function createMappedItem<T>(
    item: T,
    index: number,
    renderFn: (item: T, index: number) => Node,
): MappedItem<T> {
    const source = item !== null && typeof item === 'object' ? state(item) : null;
    const renderItem = source
        ? new Proxy(Object.create(null), {
            get: (_target, key) => Reflect.get(source.value as object, key),
            set: (_target, key, value) => Reflect.set(source.value as object, key, value),
        }) as T
        : item;
    let dispose = () => {};
    const node = createRoot(rootDispose => {
        dispose = rootDispose;
        return renderFn(renderItem, index);
    });

    return { node, dispose, source, value: item };
}

function updateMappedItem<T>(
    mapped: MappedItem<T>,
    item: T,
    index: number,
    parent: Node,
    renderFn: (item: T, index: number) => Node,
): MappedItem<T> {
    if (Object.is(mapped.value, item)) return mapped;

    if (mapped.source && item !== null && typeof item === 'object') {
        mapped.value = item;
        mapped.source.value = item;
        return mapped;
    }

    const replacement = createMappedItem(item, index, renderFn);
    mapped.dispose();
    if (mapped.node.parentNode === parent) parent.replaceChild(replacement.node, mapped.node);
    return replacement;
}

/**
 * Renders a reactive list efficiently using keyed reconciliation with LIS.
 *
 * Usage:
 *   renderList(parent, () => items.value, item => item.id, (item, index) => {
 *       return <div>{item.name}</div>;
 *   });
 */
export function renderList<T, K>(
    parent: Node,
    items: () => T[],
    keyFn: (item: T, index: number) => K,
    renderFn: (item: T, index: number) => Node,
    anchor: Node | null = null
): () => void {
    let oldKeyToItem = new Map<K, MappedItem<T>>();
    let oldKeys: K[] = [];

    const stop = effect(() => {
        const newItems = items();
        const newKeys = newItems.map((item, i) => keyFn(item, i));
        const newLen = newKeys.length;
        const oldLen = oldKeys.length;

        const newKeyToItem = new Map<K, MappedItem<T>>();
        const newIndexToOldIndex = new Array(newLen).fill(0);
        let start = 0;
        while (start < oldLen && start < newLen && Object.is(oldKeys[start], newKeys[start])) {
            const key = newKeys[start];
            newKeyToItem.set(
                key,
                updateMappedItem(oldKeyToItem.get(key)!, newItems[start], start, parent, renderFn),
            );
            newIndexToOldIndex[start] = start + 1;
            start++;
        }

        let oldEnd = oldLen - 1;
        let newEnd = newLen - 1;
        while (oldEnd >= start && newEnd >= start && Object.is(oldKeys[oldEnd], newKeys[newEnd])) {
            const key = newKeys[newEnd];
            newKeyToItem.set(
                key,
                updateMappedItem(oldKeyToItem.get(key)!, newItems[newEnd], newEnd, parent, renderFn),
            );
            newIndexToOldIndex[newEnd] = oldEnd + 1;
            oldEnd--;
            newEnd--;
        }

        let moved = false;
        let maxOldIndex = start;

        const oldKeyIndex = new Map<K, number>();
        for (let i = start; i <= oldEnd; i++) {
            oldKeyIndex.set(oldKeys[i], i);
        }

        for (let i = start; i <= newEnd; i++) {
            const key = newKeys[i];
            const existing = oldKeyToItem.get(key);

            if (existing) {
                const mapped = updateMappedItem(existing, newItems[i], i, parent, renderFn);
                newKeyToItem.set(key, mapped);
                const oldIdx = oldKeyIndex.get(key)!;
                newIndexToOldIndex[i] = oldIdx + 1;
                if (oldIdx >= maxOldIndex) {
                    maxOldIndex = oldIdx;
                } else {
                    moved = true;
                }
            } else {
                newKeyToItem.set(key, createMappedItem(newItems[i], i, renderFn));
                newIndexToOldIndex[i] = 0;
            }
        }

        for (let i = start; i <= oldEnd; i++) {
            const key = oldKeys[i];
            const mapped = oldKeyToItem.get(key)!;
            if (!newKeyToItem.has(key)) {
                mapped.dispose();
                if (mapped.node.parentNode === parent) {
                    parent.removeChild(mapped.node);
                }
            }
        }

        if (moved) {
            const middle = newIndexToOldIndex.slice(start, newEnd + 1);
            const seq = getSequence(middle);
            let seqIdx = seq.length - 1;

            for (let i = newEnd; i >= start; i--) {
                const key = newKeys[i];
                const mapped = newKeyToItem.get(key)!;
                const nextNode = i + 1 < newLen ? newKeyToItem.get(newKeys[i + 1])!.node : anchor;
                const middleIndex = i - start;

                if (newIndexToOldIndex[i] === 0) {
                    parent.insertBefore(mapped.node, nextNode);
                } else if (seqIdx < 0 || middleIndex !== seq[seqIdx]) {
                    parent.insertBefore(mapped.node, nextNode);
                } else {
                    seqIdx--;
                }
            }
        } else {
            for (let i = newEnd; i >= start; i--) {
                const key = newKeys[i];
                const mapped = newKeyToItem.get(key)!;

                if (newIndexToOldIndex[i] === 0) {
                    const nextNode = i + 1 < newLen ? newKeyToItem.get(newKeys[i + 1])!.node : anchor;
                    parent.insertBefore(mapped.node, nextNode);
                }
            }
        }

        oldKeyToItem = newKeyToItem;
        oldKeys = newKeys;
    });

    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        stop();

        for (const mapped of oldKeyToItem.values()) {
            mapped.dispose();
            if (mapped.node.parentNode === parent) parent.removeChild(mapped.node);
        }
        oldKeyToItem.clear();
        oldKeys = [];
    };

    onCleanup(dispose);
    return dispose;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount(component: () => Renderable, container: string | Element) {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) throw new Error(`Mount target not found: ${container}`);
    root.textContent = '';
    let disposeRoot = () => {};
    createRoot(dispose => {
        disposeRoot = dispose;
        insert(root, component());
    });

    return () => {
        disposeRoot();
        root.textContent = '';
    };
}
