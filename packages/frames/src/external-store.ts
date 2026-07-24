import { onCleanup, state } from './reactivity';
import type { Signal } from './reactivity';

export function externalStore<T>(
    subscribe: (notify: () => void) => () => void,
    getSnapshot: () => T,
): Signal<T> {
    const value = state(getSnapshot());
    const unsubscribe = subscribe(() => { value.value = getSnapshot(); });
    onCleanup(unsubscribe);
    return value;
}
