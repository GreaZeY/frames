import { _captureScope, _isScopeActive, batch, state } from './reactivity';
import type { Signal } from './reactivity';

export interface Mutation<T, V> {
    readonly data: Signal<T | undefined>;
    readonly error: Signal<unknown>;
    readonly loading: Signal<boolean>;
    readonly mutate: (variables: V) => Promise<T>;
    readonly reset: () => void;
}

export function mutation<T, V>(execute: (variables: V) => Promise<T>): Mutation<T, V> {
    const data = state<T | undefined>(undefined);
    const error = state<unknown>(null);
    const loading = state(false);
    const scope = _captureScope();
    let request = 0;

    const mutate = async (variables: V) => {
        const current = ++request;
        batch(() => {
            loading.value = true;
            error.value = null;
        });
        try {
            const result = await execute(variables);
            if (_isScopeActive(scope) && current === request) {
                batch(() => {
                    data.value = result;
                    loading.value = false;
                });
            }
            return result;
        } catch (cause) {
            if (_isScopeActive(scope) && current === request) {
                batch(() => {
                    error.value = cause;
                    loading.value = false;
                });
            }
            throw cause;
        }
    };

    return {
        data,
        error,
        loading,
        mutate,
        reset: () => batch(() => {
            data.value = undefined;
            error.value = null;
            loading.value = false;
        }),
    };
}
