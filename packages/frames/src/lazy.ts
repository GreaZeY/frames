import { _captureScope, _isScopeActive, _runInScope } from './reactivity';
import type { Renderable } from './runtime';

type ComponentFn<P, R extends Renderable> = (props: P) => R;
type ModuleWithDefault<P, R extends Renderable> = { default: ComponentFn<P, R> };
export type LazyComponent<P, R extends Renderable> = ((props: P) => Renderable) & {
    preload: () => Promise<void>;
};

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
export function lazy<P, R extends Renderable>(
    loader: () => Promise<ModuleWithDefault<P, R>>
): LazyComponent<P, R> {
    let cached: ComponentFn<P, R> | null = null;
    let pending: Promise<ModuleWithDefault<P, R>> | null = null;

    const load = () => {
        if (!pending) {
            pending = loader().then(module => {
                cached = module.default;
                return module;
            }).catch(error => {
                pending = null;
                throw error;
            });
        }
        return pending;
    };

    const component = (props: P) => {
        // Already resolved — call the component synchronously
        if (cached) {
            return cached(props);
        }

        // Kick off the import once, share the same promise for concurrent calls
        const scope = _captureScope();
        return load().then(mod => {
            if (!_isScopeActive(scope)) return null;
            return _runInScope(scope, () => cached!(props));
        });
    };

    component.preload = async () => { await load(); };
    return component;
}
