import { describe, it, expect, vi } from 'vitest';
import { effect } from './reactivity';
import { store, unwrap } from './store';

describe('Reactive Store', () => {
    it('tracks and notifies on top-level property change', () => {
        const obj = store({ count: 0 });
        const spy = vi.fn();

        effect(() => {
            spy(obj.count);
        });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenLastCalledWith(0);

        obj.count = 5;
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenLastCalledWith(5);
    });

    it('does not notify when value is the same', () => {
        const obj = store({ x: 1 });
        const spy = vi.fn();

        effect(() => spy(obj.x));
        expect(spy).toHaveBeenCalledTimes(1);

        obj.x = 1; // same value
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('tracks nested object properties independently', () => {
        const obj = store({ user: { name: 'Alice', age: 30 } });
        const nameSpy = vi.fn();
        const ageSpy = vi.fn();

        effect(() => nameSpy(obj.user.name));
        effect(() => ageSpy(obj.user.age));

        expect(nameSpy).toHaveBeenCalledTimes(1);
        expect(ageSpy).toHaveBeenCalledTimes(1);

        obj.user.name = 'Bob';
        expect(nameSpy).toHaveBeenCalledTimes(2);
        expect(ageSpy).toHaveBeenCalledTimes(1); // age effect should NOT re-run
    });

    it('tracks deeply nested mutations', () => {
        const obj = store({ a: { b: { c: 'deep' } } });
        const spy = vi.fn();

        effect(() => spy(obj.a.b.c));
        expect(spy).toHaveBeenLastCalledWith('deep');

        obj.a.b.c = 'changed';
        expect(spy).toHaveBeenLastCalledWith('changed');
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('handles array index mutations', () => {
        const obj = store({ items: [1, 2, 3] });
        const spy = vi.fn();

        effect(() => spy(obj.items[0]));

        obj.items[0] = 99;
        expect(spy).toHaveBeenLastCalledWith(99);
    });

    it('handles array push via length tracking', () => {
        const obj = store({ items: ['a', 'b'] });
        const spy = vi.fn();

        effect(() => spy(obj.items.length));
        expect(spy).toHaveBeenLastCalledWith(2);

        obj.items.push('c');
        expect(spy).toHaveBeenLastCalledWith(3);
    });

    it('handles replacing a nested object entirely', () => {
        const obj = store({ nested: { x: 1 } });
        const spy = vi.fn();

        effect(() => spy(obj.nested.x));
        expect(spy).toHaveBeenLastCalledWith(1);

        // Replace the entire nested object
        obj.nested = { x: 42 };
        expect(spy).toHaveBeenLastCalledWith(42);
    });

    it('unwrap returns the raw object', () => {
        const raw = { count: 0 };
        const proxy = store(raw);

        expect(unwrap(proxy)).toBe(raw);
    });

    it('returns stable child proxy references', () => {
        const obj = store({ child: { val: 1 } });
        const ref1 = obj.child;
        const ref2 = obj.child;
        expect(ref1).toBe(ref2);
    });
});
