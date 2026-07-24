import { describe, it, expect, vi } from 'vitest';
import { state, effect, derived, batch } from './reactivity';

describe('state', () => {
    it('holds and updates a value', () => {
        const count = state(0);
        expect(count.value).toBe(0);
        count.value = 5;
        expect(count.value).toBe(5);
    });

    it('does not notify when set to the same value', () => {
        const count = state(0);
        const spy = vi.fn(() => { count.value; });
        effect(spy);
        expect(spy).toHaveBeenCalledTimes(1);
        count.value = 0;
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('handles NaN correctly with Object.is', () => {
        const val = state(NaN);
        const spy = vi.fn(() => { val.value; });
        effect(spy);
        expect(spy).toHaveBeenCalledTimes(1);
        val.value = NaN;
        expect(spy).toHaveBeenCalledTimes(1); // NaN === NaN with Object.is
    });
});

describe('effect', () => {
    it('runs immediately', () => {
        const spy = vi.fn();
        effect(spy);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('re-runs when a tracked dependency changes', () => {
        const count = state(0);
        let observed = -1;
        effect(() => { observed = count.value; });
        expect(observed).toBe(0);
        count.value = 42;
        expect(observed).toBe(42);
    });

    it('tracks multiple dependencies', () => {
        const a = state(1);
        const b = state(2);
        let sum = 0;
        effect(() => { sum = a.value + b.value; });
        expect(sum).toBe(3);
        a.value = 10;
        expect(sum).toBe(12);
        b.value = 20;
        expect(sum).toBe(30);
    });

    it('cleans up stale subscriptions on re-run', () => {
        const toggle = state(true);
        const a = state(1);
        const b = state(2);
        let runs = 0;

        effect(() => {
            runs++;
            if (toggle.value) {
                a.value; // track a
            } else {
                b.value; // track b
            }
        });

        expect(runs).toBe(1);
        a.value = 10; // should trigger
        expect(runs).toBe(2);

        toggle.value = false; // re-run, now tracking b instead of a
        expect(runs).toBe(3);

        a.value = 20; // should NOT trigger since a is no longer tracked
        expect(runs).toBe(3);

        b.value = 30; // should trigger
        expect(runs).toBe(4);
    });

    it('returns a dispose function', () => {
        const count = state(0);
        let observed = 0;
        const dispose = effect(() => { observed = count.value; });
        expect(observed).toBe(0);
        count.value = 1;
        expect(observed).toBe(1);
        dispose();
        count.value = 2;
        expect(observed).toBe(1); // should not have updated
    });

    it('does not synchronously recurse when it writes to its own dependency', () => {
        const count = state(0);
        let runs = 0;

        effect(() => {
            runs++;
            if (count.value === 0) count.value = 1;
        });

        expect(count.value).toBe(1);
        expect(runs).toBe(1);
    });
});

describe('derived', () => {
    it('computes a value from dependencies', () => {
        const count = state(5);
        const doubled = derived(() => count.value * 2);
        expect(doubled.value).toBe(10);
    });

    it('updates when dependencies change', () => {
        const count = state(1);
        const tripled = derived(() => count.value * 3);
        let observed = 0;
        effect(() => { observed = tripled.value; });
        expect(observed).toBe(3);
        count.value = 4;
        expect(observed).toBe(12);
    });

    it('caches the result', () => {
        const count = state(1);
        let computeRuns = 0;
        const expensive = derived(() => { computeRuns++; return count.value * 2; });

        expensive.value;
        expensive.value;
        expensive.value;
        expect(computeRuns).toBe(1); // only computed once
    });
});

describe('batch', () => {
    it('runs a dependent effect once after multiple writes', () => {
        const first = state(1);
        const second = state(2);
        const spy = vi.fn(() => first.value + second.value);
        effect(spy);

        batch(() => {
            first.value = 3;
            second.value = 4;
        });

        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveLastReturnedWith(7);
    });
});
