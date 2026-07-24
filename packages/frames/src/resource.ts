import { batch, effect, onCleanup, state, untrack } from './reactivity';
import type { Signal } from './reactivity';

export interface Resource<T> {
    readonly data: Signal<T | undefined>;
    readonly error: Signal<unknown>;
    readonly loading: Signal<boolean>;
    readonly refetch: () => Promise<T | undefined>;
    readonly mutate: (value: T | undefined) => void;
    readonly dispose: () => void;
}

export function resource<S, T>(
    source: () => S | false | null | undefined,
    fetcher: (source: S, signal: AbortSignal) => Promise<T>,
    initialValue?: T,
): Resource<T> {
    const data = state<T | undefined>(initialValue);
    const error = state<unknown>(null);
    const loading = state(false);
    let controller: AbortController | null = null;
    let request = 0;
    let disposed = false;

    const load = async (value = untrack(source)) => {
        if (value === false || value == null || disposed) {
            request++;
            controller?.abort();
            loading.value = false;
            return undefined;
        }

        controller?.abort();
        const activeController = new AbortController();
        controller = activeController;
        const currentRequest = ++request;
        batch(() => {
            loading.value = true;
            error.value = null;
        });

        try {
            const result = await fetcher(value, activeController.signal);
            if (disposed || currentRequest !== request) return undefined;
            batch(() => {
                data.value = result;
                loading.value = false;
            });
            return result;
        } catch (cause) {
            if (disposed || currentRequest !== request || activeController.signal.aborted) return undefined;
            batch(() => {
                error.value = cause;
                loading.value = false;
            });
            return undefined;
        }
    };

    const stop = effect(() => {
        void load(source());
    });

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        request++;
        controller?.abort();
        stop();
    };

    onCleanup(dispose);

    return {
        data,
        error,
        loading,
        refetch: load,
        mutate: value => { data.value = value; },
        dispose,
    };
}
