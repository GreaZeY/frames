// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { state, effect, onCleanup } from './reactivity';
import { getSequence, insert, mount, renderList, setProperty } from './runtime';

describe('getSequence (LIS)', () => {
    it('finds the longest increasing subsequence', () => {
        expect(getSequence([1, 0, 3, 4, 2])).toEqual([0, 2, 3]);
    });

    it('handles already sorted array', () => {
        expect(getSequence([1, 2, 3])).toEqual([0, 1, 2]);
    });

    it('handles reverse sorted array', () => {
        expect(getSequence([3, 2, 1])).toEqual([2]);
    });
});

describe('insert', () => {
    it('inserts a string as a text node', () => {
        const parent = document.createElement('div');
        insert(parent, 'Hello');
        expect(parent.textContent).toBe('Hello');
    });

    it('inserts a DOM node', () => {
        const parent = document.createElement('div');
        const child = document.createElement('span');
        insert(parent, child);
        expect(parent.children[0]).toBe(child);
    });

    it('inserts an array of items', () => {
        const parent = document.createElement('div');
        insert(parent, ['A', 'B', 'C']);
        expect(parent.textContent).toBe('ABC');
    });

    it('handles async Promise insertion', async () => {
        const parent = document.createElement('div');

        let resolve!: (val: any) => void;
        const promise = new Promise<string>(r => { resolve = r; });

        insert(parent, promise);
        expect(parent.childNodes[0].nodeType).toBe(Node.COMMENT_NODE);

        resolve('Done');
        await new Promise(r => setTimeout(r, 0));

        expect(parent.textContent).toBe('Done');
        // Comment should be replaced
        const hasComment = Array.from(parent.childNodes).some(n => n.nodeType === Node.COMMENT_NODE);
        expect(hasComment).toBe(false);
    });

    it('cleans up previous content on reactive re-insert', () => {
        const parent = document.createElement('div');
        const toggle = state(true);

        insert(parent, () => toggle.value ? 'ON' : 'OFF');
        expect(parent.textContent).toBe('ON');

        toggle.value = false;
        expect(parent.textContent).toBe('OFF');
    });

    it('updates reactive text without replacing its text node', () => {
        const parent = document.createElement('div');
        const value = state('Before');

        insert(parent, () => value.value);
        const textNode = parent.firstChild;
        value.value = 'After';

        expect(parent.firstChild).toBe(textNode);
        expect(textNode?.textContent).toBe('After');
    });

    it('cleans up resolved async Promise content when reactive expression changes', async () => {
        const parent = document.createElement('div');
        const view = state<'async' | 'none'>('async');

        let resolve!: (val: any) => void;
        const promise = new Promise<Node>(r => { resolve = r; });

        insert(parent, () => view.value === 'async' ? promise : null);
        expect(parent.childNodes[0].nodeType).toBe(Node.COMMENT_NODE);

        const childEl = document.createElement('span');
        childEl.textContent = 'Async Page';
        resolve(childEl);
        await new Promise(r => setTimeout(r, 0));

        expect(parent.textContent).toBe('Async Page');

        // Switch route / view to 'none'
        view.value = 'none';
        expect(parent.textContent).toBe('');
        expect(parent.children.length).toBe(0);
    });
});

describe('controlled properties', () => {
    it('does not rewrite an input value when it is already current', () => {
        const input = document.createElement('input');
        input.value = 'entry';
        input.setSelectionRange(2, 2);

        setProperty(input, 'value', 'entry');
        expect(input.selectionStart).toBe(2);
    });
});

describe('mount ownership', () => {
    it('disposes mounted effects and cleanups when unmounted', () => {
        const root = document.createElement('div');
        const count = state(0);
        const cleanup = vi.fn();
        let runs = 0;

        const unmount = mount(() => {
            onCleanup(cleanup);
            const element = document.createElement('div');
            insert(element, () => {
                runs++;
                return count.value;
            });
            return element;
        }, root);

        count.value = 1;
        expect(root.textContent).toBe('1');
        expect(runs).toBe(2);

        unmount();
        count.value = 2;

        expect(root.textContent).toBe('');
        expect(runs).toBe(2);
        expect(cleanup).toHaveBeenCalledTimes(1);

        unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('disposes nested effects when a reactive branch is removed', () => {
        const root = document.createElement('div');
        const visible = state(true);
        const value = state(0);
        let nestedRuns = 0;

        mount(() => {
            const host = document.createElement('div');
            insert(host, () => {
                if (!visible.value) return null;

                const child = document.createElement('span');
                effect(() => {
                    nestedRuns++;
                    child.textContent = String(value.value);
                });
                return child;
            });
            return host;
        }, root);

        expect(nestedRuns).toBe(1);
        visible.value = false;
        value.value = 1;

        expect(root.textContent).toBe('');
        expect(nestedRuns).toBe(1);
    });

    it('ignores async content resolved after unmount', async () => {
        const root = document.createElement('div');
        let resolve!: (value: Node) => void;
        const pending = new Promise<Node>(done => { resolve = done; });
        const unmount = mount(() => {
            const host = document.createElement('div');
            insert(host, pending);
            return host;
        }, root);

        unmount();
        resolve(document.createTextNode('stale'));
        await Promise.resolve();

        expect(root.textContent).toBe('');
    });

    it('leaves no live effects or attached nodes after repeated unmounts', () => {
        const root = document.createElement('div');
        const value = state(0);
        const nodes: Node[] = [];
        let runs = 0;

        for (let i = 0; i < 100; i++) {
            const unmount = mount(() => {
                const element = document.createElement('div');
                nodes.push(element);
                insert(element, () => {
                    runs++;
                    return value.value;
                });
                return element;
            }, root);
            unmount();
        }

        const runsAfterUnmount = runs;
        value.value++;

        expect(runs).toBe(runsAfterUnmount);
        expect(root.childNodes).toHaveLength(0);
        expect(nodes.every(node => node.parentNode === null)).toBe(true);
    });
});

describe('renderList (keyed reconciliation)', () => {
    it('renders initial items', () => {
        const parent = document.createElement('div');
        const items = state([
            { id: 1, text: 'A' },
            { id: 2, text: 'B' },
            { id: 3, text: 'C' },
        ]);

        renderList(
            parent,
            () => items.value,
            item => item.id,
            item => {
                const el = document.createElement('div');
                el.textContent = item.text;
                return el;
            }
        );

        expect(parent.children.length).toBe(3);
        expect(parent.children[0].textContent).toBe('A');
        expect(parent.children[1].textContent).toBe('B');
        expect(parent.children[2].textContent).toBe('C');
    });

    it('adds new items', () => {
        const parent = document.createElement('div');
        const items = state([{ id: 1, text: 'A' }]);

        renderList(parent, () => items.value, i => i.id, i => {
            const el = document.createElement('div');
            el.textContent = i.text;
            return el;
        });

        expect(parent.children.length).toBe(1);

        items.value = [{ id: 1, text: 'A' }, { id: 2, text: 'B' }];
        expect(parent.children.length).toBe(2);
        expect(parent.children[1].textContent).toBe('B');
    });

    it('removes items', () => {
        const parent = document.createElement('div');
        const items = state([
            { id: 1, text: 'A' },
            { id: 2, text: 'B' },
            { id: 3, text: 'C' },
        ]);

        renderList(parent, () => items.value, i => i.id, i => {
            const el = document.createElement('div');
            el.textContent = i.text;
            return el;
        });

        items.value = [{ id: 1, text: 'A' }, { id: 3, text: 'C' }];
        expect(parent.children.length).toBe(2);
        expect(parent.children[0].textContent).toBe('A');
        expect(parent.children[1].textContent).toBe('C');
    });

    it('reorders items with minimal moves (LIS)', () => {
        const parent = document.createElement('div');
        const items = state([
            { id: 1, text: 'A' },
            { id: 2, text: 'B' },
            { id: 3, text: 'C' },
            { id: 4, text: 'D' },
        ]);

        renderList(parent, () => items.value, i => i.id, i => {
            const el = document.createElement('div');
            el.textContent = i.text;
            el.dataset.id = String(i.id);
            return el;
        });

        // Grab references to original DOM nodes
        const originalA = parent.children[0];
        const originalB = parent.children[1];
        const originalC = parent.children[2];
        const originalD = parent.children[3];

        // Move last to first: [D, A, B, C]
        items.value = [
            { id: 4, text: 'D' },
            { id: 1, text: 'A' },
            { id: 2, text: 'B' },
            { id: 3, text: 'C' },
        ];

        expect(parent.children.length).toBe(4);
        expect(parent.children[0].textContent).toBe('D');
        expect(parent.children[1].textContent).toBe('A');
        expect(parent.children[2].textContent).toBe('B');
        expect(parent.children[3].textContent).toBe('C');

        // The key insight: A, B, C should be the SAME DOM nodes (not recreated)
        expect(parent.children[1]).toBe(originalA);
        expect(parent.children[2]).toBe(originalB);
        expect(parent.children[3]).toBe(originalC);
        // D is also the same node, just moved
        expect(parent.children[0]).toBe(originalD);
    });

    it('updates same-key item content without replacing its DOM node', () => {
        const parent = document.createElement('div');
        const items = state([{ id: 1, text: 'Before' }]);

        renderList(parent, () => items.value, item => item.id, item => {
            const element = document.createElement('div');
            insert(element, () => item.text);
            return element;
        });

        const originalNode = parent.firstChild;
        items.value = [{ id: 1, text: 'After' }];

        expect(parent.firstChild).toBe(originalNode);
        expect(parent.textContent).toBe('After');
    });
});
