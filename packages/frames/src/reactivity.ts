import { _captureContext, _runWithContext } from './context';

type SubscriptionSet = Set<Subscriber>;
type ErrorHandler = (error: unknown) => void;
type SuspenseHandler = (promise: Promise<unknown>) => void;
type Subscriber = (() => void) & {
    __subscriptions?: Set<SubscriptionSet>;
    __owner?: Owner;
};

let activeEffect: Subscriber | null = null;
const effectStack: Subscriber[] = [];
const runningSubscribers = new Set<Subscriber>();
const batchQueue = new Set<Subscriber>();
let batchDepth = 0;
let isFlushing = false;

function runSubscriber(subscriber: Subscriber) {
    if (runningSubscribers.has(subscriber)) return;
    runningSubscribers.add(subscriber);
    try {
        subscriber();
    } catch (error) {
        const handler = subscriber.__owner?.errorHandler;
        if (handler) handler(error);
        else throw error;
    } finally {
        runningSubscribers.delete(subscriber);
    }
}

function flushSubscribers() {
    if (isFlushing || batchDepth > 0) return;
    isFlushing = true;
    try {
        while (batchQueue.size > 0) {
            const subscribers = [...batchQueue];
            batchQueue.clear();
            for (const subscriber of subscribers) runSubscriber(subscriber);
        }
    } finally {
        isFlushing = false;
    }
}

/** @internal - shared by signals and proxy stores */
export function _notifySubscribers(subscribers: SubscriptionSet) {
    for (const subscriber of [...subscribers]) {
        if (runningSubscribers.has(subscriber)) continue;
        if (batchDepth > 0 || isFlushing) {
            batchQueue.add(subscriber);
        } else {
            runSubscriber(subscriber);
        }
    }
}

interface Owner {
    parent: Owner | null;
    children: Set<Owner>;
    cleanups: Set<() => void>;
    errorHandler: ErrorHandler | null;
    suspenseHandler: SuspenseHandler | null;
    disposed: boolean;
}

export interface ScopeSnapshot {
    readonly owner: Owner | null;
    readonly context: ReturnType<typeof _captureContext>;
    readonly errorHandler: ErrorHandler | null;
    readonly suspenseHandler: SuspenseHandler | null;
}

let activeOwner: Owner | null = null;
let activeErrorHandler: ErrorHandler | null = null;
let activeSuspenseHandler: SuspenseHandler | null = null;
let nextId = 0;

function createOwner(parent: Owner | null): Owner {
    const owner: Owner = {
        parent,
        children: new Set(),
        cleanups: new Set(),
        errorHandler: activeErrorHandler ?? parent?.errorHandler ?? null,
        suspenseHandler: activeSuspenseHandler ?? parent?.suspenseHandler ?? null,
        disposed: false,
    };
    parent?.children.add(owner);
    return owner;
}

function disposeOwner(owner: Owner) {
    if (owner.disposed) return;
    owner.disposed = true;

    for (const child of [...owner.children]) disposeOwner(child);
    for (const cleanup of [...owner.cleanups]) cleanup();

    owner.children.clear();
    owner.cleanups.clear();
    owner.parent?.children.delete(owner);
}

function runWithOwner<T>(owner: Owner, fn: () => T): T {
    const previousOwner = activeOwner;
    activeOwner = owner;
    try {
        return fn();
    } finally {
        activeOwner = previousOwner;
    }
}

/** @internal */
export function _captureScope(): ScopeSnapshot {
    return {
        owner: activeOwner,
        context: _captureContext(),
        errorHandler: activeErrorHandler ?? activeOwner?.errorHandler ?? null,
        suspenseHandler: activeSuspenseHandler ?? activeOwner?.suspenseHandler ?? null,
    };
}

/** @internal */
export function _isScopeActive(scope: ScopeSnapshot): boolean {
    return !scope.owner?.disposed;
}

/** @internal */
export function _runInScope<T>(scope: ScopeSnapshot, fn: () => T): T {
    const previousOwner = activeOwner;
    const previousErrorHandler = activeErrorHandler;
    const previousSuspenseHandler = activeSuspenseHandler;
    activeOwner = scope.owner;
    activeErrorHandler = scope.errorHandler;
    activeSuspenseHandler = scope.suspenseHandler;
    try {
        return _runWithContext(scope.context, fn);
    } finally {
        activeOwner = previousOwner;
        activeErrorHandler = previousErrorHandler;
        activeSuspenseHandler = previousSuspenseHandler;
    }
}

/** @internal */
export function _withErrorHandler<T>(handler: ErrorHandler, fn: () => T): T {
    const previous = activeErrorHandler;
    activeErrorHandler = handler;
    if (activeOwner) activeOwner.errorHandler = handler;
    try {
        return fn();
    } finally {
        activeErrorHandler = previous;
    }
}

/** @internal */
export function _withSuspenseHandler<T>(handler: SuspenseHandler, fn: () => T): T {
    const previous = activeSuspenseHandler;
    activeSuspenseHandler = handler;
    if (activeOwner) activeOwner.suspenseHandler = handler;
    try {
        return fn();
    } finally {
        activeSuspenseHandler = previous;
    }
}

/** @internal */
export function _handleScopeError(scope: ScopeSnapshot, error: unknown) {
    if (scope.errorHandler) scope.errorHandler(error);
    else console.error(error);
}

/** @internal */
export function _registerSuspense(scope: ScopeSnapshot, promise: Promise<unknown>) {
    scope.suspenseHandler?.(promise);
}

export function createRoot<T>(fn: (dispose: () => void) => T): T {
    const owner = createOwner(null);
    try {
        return runWithOwner(owner, () => fn(() => disposeOwner(owner)));
    } catch (error) {
        disposeOwner(owner);
        throw error;
    }
}

/** @internal — used by store.ts to hook into the same tracking system */
export function _getActiveEffect() {
    return activeEffect;
}

export type Signal<T> = {
    readonly value: T;
} & { value: T };

export function effect(fn: () => void): () => void {
    const subscriptions = new Set<SubscriptionSet>();
    const owner = createOwner(activeOwner);
    const context = _captureContext();

    const effectFn: Subscriber = () => {
        if (owner.disposed) return;

        // Dispose everything created by the previous execution.
        for (const child of [...owner.children]) disposeOwner(child);

        // Clear old subscriptions so stale dependencies are dropped
        for (const depSet of subscriptions) {
            depSet.delete(effectFn);
        }
        subscriptions.clear();

        effectStack.push(effectFn);
        activeEffect = effectFn;
        const runOwner = createOwner(owner);
        try {
            _runWithContext(context, () => runWithOwner(runOwner, fn));
        } finally {
            effectStack.pop();
            activeEffect = effectStack[effectStack.length - 1] || null;
        }
    };

    // Attach subscription tracking so signals can register themselves
    effectFn.__subscriptions = subscriptions;
    effectFn.__owner = owner;

    owner.cleanups.add(() => {
        for (const depSet of subscriptions) depSet.delete(effectFn);
        subscriptions.clear();
    });

    runSubscriber(effectFn);

    return () => disposeOwner(owner);
}

export function state<T>(initialValue: T): Signal<T> {
    let _value = initialValue;
    const subscribers: SubscriptionSet = new Set();

    return {
        get value() {
            if (activeEffect) {
                subscribers.add(activeEffect);
                // Register this dep set on the effect for cleanup
                const subs = activeEffect.__subscriptions;
                if (subs) subs.add(subscribers);
            }
            return _value;
        },
        set value(newValue: T) {
            if (!Object.is(_value, newValue)) {
                _value = newValue;
                _notifySubscribers(subscribers);
            }
        }
    };
}

// Derived / computed value — lazy, cached, auto-tracked
export function derived<T>(fn: () => T): { readonly value: T } {
    let cached: T;
    let dirty = true;
    const subscribers: SubscriptionSet = new Set();

    const markDirty = () => {
        if (!dirty) {
            dirty = true;
            _notifySubscribers(subscribers);
        }
    };

    // Track the computation's own dependencies
    let dispose: (() => void) | null = null;
    onCleanup(() => dispose?.());

    return {
        get value() {
            if (activeEffect) {
                subscribers.add(activeEffect);
                const subs = activeEffect.__subscriptions;
                if (subs) subs.add(subscribers);
            }

            if (dirty) {
                // Dispose previous tracking
                if (dispose) dispose();

                // Re-run computation inside an effect to track deps
                const depSets = new Set<SubscriptionSet>();
                effectStack.push(markDirty);
                const prev = activeEffect;
                activeEffect = markDirty;
                (markDirty as Subscriber).__subscriptions = depSets;
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

export function batch(fn: () => void) {
    batchDepth++;
    try {
        fn();
    } finally {
        batchDepth--;
        flushSubscribers();
    }
}

export function onCleanup(fn: () => void) {
    activeOwner?.cleanups.add(fn);
}

export function onMount(fn: () => void | (() => void)) {
    const scope = _captureScope();
    queueMicrotask(() => {
        if (!_isScopeActive(scope)) return;
        _runInScope(scope, () => {
            const cleanup = fn();
            if (cleanup) onCleanup(cleanup);
        });
    });
}

export function untrack<T>(fn: () => T): T {
    const previousEffect = activeEffect;
    activeEffect = null;
    try {
        return fn();
    } finally {
        activeEffect = previousEffect;
    }
}

export function uniqueId(prefix = 'frames'): string {
    return `${prefix}-${++nextId}`;
}
