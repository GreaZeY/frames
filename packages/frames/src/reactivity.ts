let activeEffect: (() => void) | null = null;
const effectStack: (() => void)[] = [];

/** @internal — used by store.ts to hook into the same tracking system */
export function _getActiveEffect() {
    return activeEffect;
}

export type Signal<T> = {
    readonly value: T;
} & { value: T };

export function effect(fn: () => void): () => void {
    const subscriptions = new Set<Set<() => void>>();

    const effectFn = () => {
        // Run cleanups from the previous execution
        const cleanups = cleanupMap.get(effectFn);
        if (cleanups) {
            for (const c of cleanups) {
                c();
            }
            cleanupMap.set(effectFn, []);
        }

        // Clear old subscriptions so stale dependencies are dropped
        for (const depSet of subscriptions) {
            depSet.delete(effectFn);
        }
        subscriptions.clear();

        effectStack.push(effectFn);
        activeEffect = effectFn;
        try {
            fn();
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    };

    // Attach subscription tracking so signals can register themselves
    (effectFn as any).__subscriptions = subscriptions;

    effectFn();

    // Return a dispose function
    return () => {
        const cleanups = cleanupMap.get(effectFn);
        if (cleanups) {
            for (const c of cleanups) {
                c();
            }
            cleanupMap.delete(effectFn);
        }
        for (const depSet of subscriptions) {
            depSet.delete(effectFn);
        }
        subscriptions.clear();
    };
}

export function state<T>(initialValue: T): Signal<T> {
    let _value = initialValue;
    const subscribers = new Set<() => void>();

    return {
        get value() {
            if (activeEffect) {
                subscribers.add(activeEffect);
                // Register this dep set on the effect for cleanup
                const subs = (activeEffect as any).__subscriptions as Set<Set<() => void>> | undefined;
                if (subs) subs.add(subscribers);
            }
            return _value;
        },
        set value(newValue: T) {
            if (!Object.is(_value, newValue)) {
                _value = newValue;
                // MUST copy to prevent infinite loops because effects re-subscribe synchronously
                const toRun = [...subscribers];
                if (batchDepth > 0) {
                    for (const sub of toRun) {
                        batchQueue.add(sub);
                    }
                } else {
                    for (const sub of toRun) {
                        sub();
                    }
                }
            }
        }
    };
}

// Derived / computed value — lazy, cached, auto-tracked
export function derived<T>(fn: () => T): { readonly value: T } {
    let cached: T;
    let dirty = true;
    const subscribers = new Set<() => void>();

    const markDirty = () => {
        if (!dirty) {
            dirty = true;
            const toRun = [...subscribers];
            if (batchDepth > 0) {
                for (const sub of toRun) {
                    batchQueue.add(sub);
                }
            } else {
                for (const sub of toRun) {
                    sub();
                }
            }
        }
    };

    // Track the computation's own dependencies
    let dispose: (() => void) | null = null;

    return {
        get value() {
            if (activeEffect) {
                subscribers.add(activeEffect);
                const subs = (activeEffect as any).__subscriptions as Set<Set<() => void>> | undefined;
                if (subs) subs.add(subscribers);
            }

            if (dirty) {
                // Dispose previous tracking
                if (dispose) dispose();

                // Re-run computation inside an effect to track deps
                const depSets = new Set<Set<() => void>>();
                effectStack.push(markDirty);
                const prev = activeEffect;
                activeEffect = markDirty;
                (markDirty as any).__subscriptions = depSets;
                try {
                    cached = fn();
                } finally {
                    effectStack.pop();
                    activeEffect = prev;
                }
                dispose = () => {
                    for (const ds of depSets) {
                        ds.delete(markDirty);
                    }
                    depSets.clear();
                };
                dirty = false;
            }
            return cached;
        }
    };
}

// Batch multiple state updates into a single flush
let batchDepth = 0;
let batchQueue: Set<() => void> = new Set();

export function batch(fn: () => void) {
    batchDepth++;
    try {
        fn();
    } finally {
        batchDepth--;
        if (batchDepth === 0) {
            const toRun = [...batchQueue];
            batchQueue.clear();
            for (const sub of toRun) {
                sub();
            }
        }
    }
}

// onCleanup: register a cleanup function for the current effect
const cleanupMap = new WeakMap<() => void, (() => void)[]>();

export function onCleanup(fn: () => void) {
    if (activeEffect) {
        let cleanups = cleanupMap.get(activeEffect);
        if (!cleanups) {
            cleanups = [];
            cleanupMap.set(activeEffect, cleanups);
        }
        cleanups.push(fn);
    }
}
