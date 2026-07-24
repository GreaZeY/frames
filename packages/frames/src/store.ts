/**
 * Reactive Store — deep proxy-based reactivity.
 * 
 * Every unique property path (e.g. "address.city") gets its own subscriber set.
 * Reads inside an effect track the exact path; writes notify only that path's subscribers.
 */

// We need access to the effect tracking internals.
// Import the module so we can read activeEffect and register subscriptions.
import { _getActiveEffect, _notifySubscribers, batch } from './reactivity';

// Access the module's internal `activeEffect` via a shared getter we'll add.
// For now, we tap into the same pattern: the store creates its own subscriber sets
// per-path and registers them on effects the same way state() does.

type StoreSubscriber = ReturnType<typeof _getActiveEffect> & {};
type SubscriberMap = Map<string | symbol, Set<NonNullable<StoreSubscriber>>>;
const ARRAY_MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse']);
const rawToProxy = new WeakMap<object, object>();
const proxyToRaw = new WeakMap<object, object>();

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
    const active = _getActiveEffect();
    if (active) {
        const subSet = getOrCreateSubSet(subs, key);
        subSet.add(active);
        // Register on the effect's subscription set for automatic cleanup
        const effectSubs = active.__subscriptions;
        if (effectSubs) effectSubs.add(subSet);
    }
}

function notifyProperty(subs: SubscriberMap, key: string | symbol) {
    const subSet = subs.get(key);
    if (subSet) _notifySubscribers(subSet);
}

function isPlainObject(val: unknown): val is Record<string | symbol, unknown> {
    if (val === null || typeof val !== 'object') return false;
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null || Array.isArray(val);
}

function createProxy<T extends object>(target: T): T {
    if (proxyToRaw.has(target)) return target;
    const cached = rawToProxy.get(target);
    if (cached) return cached as T;

    const subs: SubscriberMap = new Map();
    const mutators = new Map<string, (...args: unknown[]) => unknown>();

    const proxy = new Proxy(target, {
        get(obj, key, receiver) {
            trackProperty(subs, key);

            const value = Reflect.get(obj, key, receiver);

            // Intercept array mutating methods so they go through the proxy's set trap
            if (Array.isArray(obj) && typeof key === 'string' && ARRAY_MUTATORS.has(key) && typeof value === 'function') {
                let mutator = mutators.get(key);
                if (!mutator) {
                    mutator = (...args: unknown[]) => {
                        let result: unknown;
                        batch(() => {
                            result = Reflect.apply(value, receiver, args);
                            notifyProperty(subs, 'length');
                        });
                        return result;
                    };
                    mutators.set(key, mutator);
                }
                return mutator;
            }

            // Recursively wrap nested plain objects/arrays
            if (isPlainObject(value) && typeof key !== 'symbol') return createProxy(value as object);

            return value;
        },

        set(obj, key, newValue, receiver) {
            const oldValue = Reflect.get(obj, key, receiver);
            const result = Reflect.set(obj, key, newValue, receiver);

            if (!Object.is(oldValue, newValue)) {
                notifyProperty(subs, key);
            }

            return result;
        },

        deleteProperty(obj, key) {
            const had = key in obj;
            const result = Reflect.deleteProperty(obj, key);
            if (had) {
                notifyProperty(subs, key);
            }
            return result;
        }
    });

    rawToProxy.set(target, proxy);
    proxyToRaw.set(proxy, target);
    return proxy;
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
    return (proxyToRaw.get(proxy) as T | undefined) || proxy;
}
