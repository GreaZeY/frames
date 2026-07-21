type ComponentFn<P = any> = (props: P) => any;
type ModuleWithDefault<P = any> = { default: ComponentFn<P> };

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
export function lazy<P extends Record<string, any>>(
    loader: () => Promise<ModuleWithDefault<P>>
): ComponentFn<P> {
    let cached: ComponentFn<P> | null = null;
    let pending: Promise<ModuleWithDefault<P>> | null = null;

    return (props: P) => {
        // Already resolved — call the component synchronously
        if (cached) {
            return cached(props);
        }

        // Kick off the import once, share the same promise for concurrent calls
        if (!pending) {
            pending = loader();
        }

        // Return a Promise that `insert()` handles natively
        return pending.then(mod => {
            cached = mod.default;
            return cached(props);
        });
    };
}
