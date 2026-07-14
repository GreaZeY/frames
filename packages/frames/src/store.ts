/**
 * Reactive Store — deep proxy-based reactivity.
 * 
 * Every unique property path (e.g. "address.city") gets its own subscriber set.
 * Reads inside an effect track the exact path; writes notify only that path's subscribers.
 */

// We need access to the effect tracking internals.
// Import the module so we can read activeEffect and register subscriptions.
import * as reactivity from './reactivity';

// Access the module's internal `activeEffect` via a shared getter we'll add.
// For now, we tap into the same pattern: the store creates its own subscriber sets
// per-path and registers them on effects the same way state() does.

const STORE_RAW = Symbol('store_raw');
const STORE_SUBSCRIBERS = Symbol('store_subscribers');

type SubscriberMap = Map<string | symbol, Set<() => void>>;
const ARRAY_MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']);

function getSubscribers(obj: any): SubscriberMap {
    if (!obj[STORE_SUBSCRIBERS]) {
        obj[STORE_SUBSCRIBERS] = new Map();
    }
    return obj[STORE_SUBSCRIBERS];
}

function getOrCreateSubSet(subs: SubscriberMap, key: string | symbol): Set<() => void> {
    let set = subs.get(key);
    if (!set) {
        set = new Set();
        subs.set(key, set);
    }
    return set;
}

function trackProperty(subs: SubscriberMap, key: string | symbol) {
    // Access the currently running effect from the reactivity module.
    // We use the exported `_getActiveEffect()` helper.
    const active = reactivity._getActiveEffect();
    if (active) {
        const subSet = getOrCreateSubSet(subs, key);
        subSet.add(active);
        // Register on the effect's subscription set for automatic cleanup
        const effectSubs = (active as any).__subscriptions as Set<Set<() => void>> | undefined;
        if (effectSubs) effectSubs.add(subSet);
    }
}

function notifyProperty(subs: SubscriberMap, key: string | symbol) {
    const subSet = subs.get(key);
    if (subSet) {
        // MUST copy to prevent infinite loops
        const toRun = [...subSet];
        for (const sub of toRun) {
            sub();
        }
    }
}

function isPlainObject(val: unknown): val is Record<string | symbol, unknown> {
    if (val === null || typeof val !== 'object') return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null || Array.isArray(val);
}

function createProxy<T extends object>(target: T): T {
    // If already a store proxy, return as-is
    if ((target as any)[STORE_RAW]) return target as T;

    const subs: SubscriberMap = new Map();
    (target as any)[STORE_SUBSCRIBERS] = subs;

    // Cache child proxies so we return the same reference
    const childProxies = new Map<string | symbol, any>();



    return new Proxy(target, {
        get(obj, key, receiver) {
            if (key === STORE_RAW) return obj;

            trackProperty(subs, key);

            const value = Reflect.get(obj, key, receiver);

            // Intercept array mutating methods so they go through the proxy's set trap
            if (Array.isArray(obj) && typeof key === 'string' && ARRAY_MUTATORS.has(key) && typeof value === 'function') {
                return (...args: any[]) => {
                    const result = (value as Function).apply(receiver, args);
                    // Notify length since mutating methods change it
                    notifyProperty(subs, 'length');
                    return result;
                };
            }

            // Recursively wrap nested plain objects/arrays
            if (isPlainObject(value) && typeof key !== 'symbol') {
                if (!childProxies.has(key)) {
                    childProxies.set(key, createProxy(value as object));
                }
                return childProxies.get(key);
            }

            return value;
        },

        set(obj, key, newValue, receiver) {
            const oldValue = Reflect.get(obj, key, receiver);
            const result = Reflect.set(obj, key, newValue, receiver);

            if (!Object.is(oldValue, newValue)) {
                // Invalidate cached child proxy if the value changed
                childProxies.delete(key);
                notifyProperty(subs, key);
            }

            return result;
        },

        deleteProperty(obj, key) {
            const had = key in obj;
            const result = Reflect.deleteProperty(obj, key);
            if (had) {
                childProxies.delete(key);
                notifyProperty(subs, key);
            }
            return result;
        }
    });
}

/**
 * Creates a deeply reactive store from a plain object or array.
 * 
 * Usage:
 * ```ts
 * const user = store({ name: 'Alice', address: { city: 'NYC' } });
 * 
 * effect(() => console.log(user.address.city));
 * // logs "NYC"
 * 
 * user.address.city = 'LA';
 * // logs "LA" — only this effect re-runs, not effects reading user.name
 * ```
 */
export function store<T extends object>(initial: T): T {
    return createProxy(initial);
}

/**
 * Gets the raw (unwrapped) object behind a store proxy.
 */
export function unwrap<T extends object>(proxy: T): T {
    return (proxy as any)[STORE_RAW] || proxy;
}
