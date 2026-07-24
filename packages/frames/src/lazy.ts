import { _captureScope, _isScopeActive, _runInScope } from './reactivity';
import type { SyncRenderable } from './runtime';

type ComponentFn<P, R extends SyncRenderable> = (props: P) => R;
type ModuleWithDefault<P, R extends SyncRenderable> = { default: ComponentFn<P, R> };

/**
 * Lazily loads a component from a dynamic import.
 * The import only fires the first time the component is rendered.
 * Subsequent renders reuse the cached module.
 *
 * Works seamlessly with the existing async handling in `insert()` —
 * a comment placeholder is shown until the module resolves, then
 * the real component swaps in.
 *
 * Usage:
 * ```ts
 * const HeavyChart = lazy(() => import('./components/HeavyChart'));
 *
 * // In JSX — renders a placeholder, then the real component
 * <HeavyChart data={myData} />
 * ```
 */
export function lazy<P extends Record<string, unknown>, R extends SyncRenderable>(
    loader: () => Promise<ModuleWithDefault<P, R>>
): (props: P) => R | Promise<R | null> {
    let cached: ComponentFn<P, R> | null = null;
    let pending: Promise<ModuleWithDefault<P, R>> | null = null;

    return (props: P) => {
        // Already resolved — call the component synchronously
        if (cached) {
            return cached(props);
        }

        // Kick off the import once, share the same promise for concurrent calls
        if (!pending) {
            pending = loader().catch(error => {
                pending = null;
                throw error;
            });
        }

        const scope = _captureScope();
        return pending.then(mod => {
            cached = mod.default;
            if (!_isScopeActive(scope)) return null;
            return _runInScope(scope, () => cached!(props));
        });
    };
}
