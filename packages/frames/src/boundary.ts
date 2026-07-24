import {
    _captureScope,
    _isScopeActive,
    _withErrorHandler,
    _withSuspenseHandler,
    onCleanup,
    state,
} from './reactivity';
import { insert } from './runtime';
import type { Renderable } from './runtime';

const resolve = (value: Renderable | (() => Renderable)) =>
    typeof value === 'function' ? value() : value;

export function ErrorBoundary(props: {
    children: () => Renderable;
    fallback: (error: unknown, reset: () => void) => Renderable;
}) {
    const host = document.createElement('div');
    host.style.display = 'contents';
    const error = state<unknown>(null);
    const failed = state(false);
    const handle = (cause: unknown) => queueMicrotask(() => {
        error.value = cause;
        failed.value = true;
    });
    const reset = () => { failed.value = false; };

    insert(host, () => {
        if (failed.value) return props.fallback(error.value, reset);
        try {
            return _withErrorHandler(handle, props.children);
        } catch (cause) {
            handle(cause);
            return null;
        }
    });
    return host;
}

export function Suspense(props: {
    children: () => Renderable;
    fallback: Renderable | (() => Renderable);
}) {
    const host = document.createElement('div');
    host.style.display = 'contents';
    const pending = state(0);
    const seen = new WeakSet<Promise<unknown>>();
    const scope = _captureScope();

    const register = (promise: Promise<unknown>) => {
        if (seen.has(promise)) return;
        seen.add(promise);
        let counted = false;
        let settled = false;
        const finish = () => {
            settled = true;
            if (counted && _isScopeActive(scope)) pending.value--;
        };
        promise.then(finish, finish);
        queueMicrotask(() => {
            if (settled || !_isScopeActive(scope)) return;
            counted = true;
            pending.value++;
        });
    };

    insert(host, () => pending.value > 0
        ? resolve(props.fallback)
        : _withSuspenseHandler(register, props.children));
    onCleanup(() => { pending.value = 0; });
    return host;
}
