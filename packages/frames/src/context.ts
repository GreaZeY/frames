/**
 * The global context stack. 
 * Since Frames components execute synchronously, we can track context via a simple array of Maps.
 */
const contextStack: Map<symbol, any>[] = [];

export interface Context<T> {
    id: symbol;
    defaultValue: T;
    Provider: (props: { value?: T, children?: () => any }) => any;
}

/**
 * Creates a Context object.
 */
export function createContext<T>(defaultValue?: T): Context<T | undefined> {
    const id = Symbol('context');

    return {
        id,
        defaultValue,
        Provider(props: { value?: T, children?: () => any }) {
            // Inherit from current layer, or create new if empty
            const currentLayer = contextStack[contextStack.length - 1] || new Map<symbol, any>();
            const newLayer = new Map(currentLayer);
            
            // Register this provider's value
            if ('value' in props) {
                newLayer.set(id, props.value);
            }
            
            contextStack.push(newLayer);

            try {
                // Execute children inside this context layer.
                // Our Babel plugin guarantees custom component children are wrapped in () => ...
                if (props.children && typeof props.children === 'function') {
                    return props.children();
                }
                return props.children;
            } finally {
                // Restore previous context
                contextStack.pop();
            }
        }
    };
}

/**
 * Resolves the value of a Context from the nearest Provider in the tree.
 */
export function useContext<T>(context: Context<T>): T {
    const currentLayer = contextStack[contextStack.length - 1];
    if (currentLayer && currentLayer.has(context.id)) {
        return currentLayer.get(context.id);
    }
    return context.defaultValue;
}
