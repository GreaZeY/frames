import { effect } from './reactivity';

// ─── DOM Insertion ───────────────────────────────────────────────────────────

export function insert(parent: Node, child: any, anchor: Node | null = null, current?: any): any {
    if (typeof child === 'function') {
        effect(() => {
            current = insert(parent, child(), anchor, current);
        });
        return current;
    }

    // Cleanup previous nodes
    if (current != null) {
        let toRemove: any[] = [];
        if (Array.isArray(current)) {
            toRemove = current;
        } else if (current instanceof Node) {
            toRemove = [current];
        } else if (typeof current === 'object' && current.nodes) {
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
        const ref = { nodes: [placeholder] as any[] };

        child.then(resolvedChild => {
            if (placeholder.parentNode) {
                const res = insert(parent, resolvedChild, anchor, placeholder);
                if (Array.isArray(res)) {
                    ref.nodes = res;
                } else if (typeof res === 'object' && res !== null && res.nodes) {
                    ref.nodes = res.nodes;
                } else if (res != null) {
                    ref.nodes = [res];
                }
            }
        });
        return ref;
    }

    if (Array.isArray(child)) {
        const nodes: any[] = [];
        for (let i = 0; i < child.length; i++) {
            const inserted = insert(parent, child[i], anchor);
            if (Array.isArray(inserted)) {
                for (let j = 0; j < inserted.length; j++) nodes.push(inserted[j]);
            } else if (inserted != null) {
                nodes.push(inserted);
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

interface MappedItem {
    node: Node;
    dispose: (() => void) | null;
}

/**
 * Renders a reactive list efficiently using keyed reconciliation with LIS.
 *
 * Usage:
 *   renderList(parent, () => items.value, item => item.id, (item, index) => {
 *       return <div>{item.name}</div>;
 *   });
 */
export function renderList<T>(
    parent: Node,
    items: () => T[],
    keyFn: (item: T, index: number) => any,
    renderFn: (item: T, index: number) => Node,
    anchor: Node | null = null
): void {
    let oldKeyToItem = new Map<any, MappedItem>();
    let oldKeys: any[] = [];

    effect(() => {
        const newItems = items();
        const newKeys = newItems.map((item, i) => keyFn(item, i));
        const newLen = newKeys.length;
        const oldLen = oldKeys.length;

        const newKeyToItem = new Map<any, MappedItem>();

        // Phase 1: Build map of new items, reusing existing nodes where possible
        const newIndexToOldIndex = new Array(newLen).fill(0);
        let moved = false;
        let maxOldIndex = 0;

        // Build O(1) lookup for old key positions
        const oldKeyIndex = new Map<any, number>();
        for (let i = 0; i < oldLen; i++) {
            oldKeyIndex.set(oldKeys[i], i);
        }

        for (let i = 0; i < newLen; i++) {
            const key = newKeys[i];
            const existing = oldKeyToItem.get(key);

            if (existing) {
                newKeyToItem.set(key, existing);
                const oldIdx = oldKeyIndex.get(key)!;
                newIndexToOldIndex[i] = oldIdx + 1;
                if (oldIdx >= maxOldIndex) {
                    maxOldIndex = oldIdx;
                } else {
                    moved = true;
                }
            } else {
                const node = renderFn(newItems[i], i);
                newKeyToItem.set(key, { node, dispose: null });
                newIndexToOldIndex[i] = 0;
            }
        }

        // Phase 2: Remove old items that are no longer present
        for (const [key, mapped] of oldKeyToItem) {
            if (!newKeyToItem.has(key)) {
                if (mapped.dispose) mapped.dispose();
                if (mapped.node.parentNode === parent) {
                    parent.removeChild(mapped.node);
                }
            }
        }

        // Phase 3: Move/insert nodes into correct position
        if (moved) {
            const seq = getSequence(newIndexToOldIndex);
            let seqIdx = seq.length - 1;

            // Iterate backwards so insertBefore targets are already in place
            for (let i = newLen - 1; i >= 0; i--) {
                const key = newKeys[i];
                const mapped = newKeyToItem.get(key)!;
                const nextNode = i + 1 < newLen ? newKeyToItem.get(newKeys[i + 1])!.node : anchor;

                if (newIndexToOldIndex[i] === 0) {
                    // Brand new — insert
                    parent.insertBefore(mapped.node, nextNode);
                } else if (seqIdx < 0 || i !== seq[seqIdx]) {
                    // Not in LIS — move
                    parent.insertBefore(mapped.node, nextNode);
                } else {
                    // In LIS — already in correct relative position, skip
                    seqIdx--;
                }
            }
        } else {
            // No moves needed, just insert new items in order
            for (let i = newLen - 1; i >= 0; i--) {
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
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount(component: () => Node, container: string | Element) {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) throw new Error(`Mount target not found: ${container}`);
    root.textContent = '';
    insert(root, component());
}
