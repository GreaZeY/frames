import { describe, expect, it } from 'vitest';
import { externalStore } from './external-store';
import { createRoot } from './reactivity';

describe('externalStore', () => {
    it('tracks and unsubscribes from an external source', () => {
        let snapshot = 1;
        let notify = () => {};
        let unsubscribed = false;
        let dispose = () => {};
        const value = createRoot(disposeRoot => {
            dispose = disposeRoot;
            return externalStore(
                next => {
                    notify = next;
                    return () => { unsubscribed = true; };
                },
                () => snapshot,
            );
        });

        snapshot = 2;
        notify();
        expect(value.value).toBe(2);
        dispose();
        expect(unsubscribed).toBe(true);
    });
});
