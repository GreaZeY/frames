type ContextSnapshot = ReadonlyMap<symbol, unknown>;

let activeContext: ContextSnapshot = new Map();

/** @internal */
export function _captureContext(): ContextSnapshot {
    return activeContext;
}

/** @internal */
export function _runWithContext<T>(context: ContextSnapshot, fn: () => T): T {
    const previousContext = activeContext;
    activeContext = context;
    try {
        return fn();
    } finally {
        activeContext = previousContext;
    }
}

export interface Context<T> {
    id: symbol;
    defaultValue: T;
    Provider: <R>(props: { value?: T, children: () => R }) => R;
}

/**
 * Creates a Context object.
 */
export function createContext<T>(defaultValue?: T): Context<T | undefined> {
    const id = Symbol('context');

    return {
        id,
        defaultValue,
        Provider<R>(props: { value?: T, children: () => R }) {
            const context = new Map(activeContext);
            
            if ('value' in props) {
                context.set(id, props.value);
            }

            const result = _runWithContext(context, props.children);
            if (typeof result !== 'function') return result;

            return ((...args: unknown[]) =>
                _runWithContext(context, () => (result as (...values: unknown[]) => unknown)(...args))) as R;
        }
    };
}

/**
 * Resolves the value of a Context from the nearest Provider in the tree.
 */
export function useContext<T>(context: Context<T>): T {
    if (activeContext.has(context.id)) {
        return activeContext.get(context.id) as T;
    }
    return context.defaultValue;
}
