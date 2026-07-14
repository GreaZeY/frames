// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { state, effect } from './reactivity';
import { getSequence, insert, renderList } from './runtime';

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
        const promise = new Promise(r => { resolve = r; });

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
});
