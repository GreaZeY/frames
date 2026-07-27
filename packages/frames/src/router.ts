import { state, effect, onCleanup } from './reactivity';
import type { Signal } from './reactivity';
import { insert } from './runtime';
import type { Renderable } from './runtime';
import { createContext, useContext } from './context';
import { ErrorBoundary, Suspense } from './boundary';

// ─── Global Router State ─────────────────────────────────────────────────────

// Only run in the browser
const isBrowser = typeof window !== 'undefined';
const getLocationPath = () =>
    `${window.location.pathname}${window.location.search}${window.location.hash}`;
export const currentPath = state(isBrowser ? getLocationPath() : '/');
const ParamsContext = createContext<Record<string, string>>({});
const OutletContext = createContext<Renderable>(null);

if (isBrowser) {
    window.addEventListener('popstate', () => {
        currentPath.value = getLocationPath();
    });
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export interface NavigateOptions {
    replace?: boolean;
    state?: unknown;
}

export type NavigateTarget = string | number;

type BlockerState = 'unblocked' | 'blocked' | 'proceeding';

export interface NavigationBlocker {
    state: Signal<BlockerState>;
    proceed: () => void;
    reset: () => void;
}

type PendingNavigation = () => void;
type BlockerEntry = {
    enabled: () => boolean;
    state: Signal<BlockerState>;
    pending: PendingNavigation | null;
};

const blockers = new Set<BlockerEntry>();

const runNavigation = (action: PendingNavigation, bypass?: BlockerEntry) => {
    const blocker = [...blockers].find(entry => entry !== bypass && entry.enabled());
    if (!blocker) {
        action();
        return true;
    }

    blocker.pending = action;
    blocker.state.value = 'blocked';
    return false;
};

export function navigate(
    target: NavigateTarget,
    options: boolean | NavigateOptions = false,
) {
    if (!isBrowser) return;

    const resolved = typeof options === 'boolean' ? { replace: options } : options;
    runNavigation(() => {
        if (typeof target === 'number') {
            window.history.go(target);
            return;
        }

        if (resolved.replace) {
            window.history.replaceState(resolved.state ?? null, '', target);
        } else {
            window.history.pushState(resolved.state ?? null, '', target);
        }
        currentPath.value = getLocationPath();
    });
}

export const useNavigate = () => navigate;

export const location = {
    get pathname() {
        return new URL(currentPath.value, 'http://frames.local').pathname;
    },
    get search() {
        return new URL(currentPath.value, 'http://frames.local').search;
    },
    get hash() {
        return new URL(currentPath.value, 'http://frames.local').hash;
    },
    get state() {
        return isBrowser ? window.history.state : null;
    },
};

export const useLocation = () => location;

const reactiveSearchParams = new Proxy(new URLSearchParams(), {
    get(_target, property) {
        const params = searchParams();
        const value = Reflect.get(params, property, params);
        return typeof value === 'function' ? value.bind(params) : value;
    },
});

export function setSearchParams(
    next: URLSearchParams | string | Record<string, string>,
    options: NavigateOptions = {},
) {
    const params = next instanceof URLSearchParams
        ? next
        : new URLSearchParams(next);
    const query = params.toString();
    navigate(`${location.pathname}${query ? `?${query}` : ''}${location.hash}`, options);
}

export const useSearchParams = () => [reactiveSearchParams, setSearchParams] as const;

export function useBlocker(enabled: boolean | (() => boolean)): NavigationBlocker {
    const entry: BlockerEntry = {
        enabled: typeof enabled === 'function' ? enabled : () => enabled,
        state: state<BlockerState>('unblocked'),
        pending: null,
    };
    blockers.add(entry);
    onCleanup(() => blockers.delete(entry));

    return {
        state: entry.state,
        proceed: () => {
            const pending = entry.pending;
            entry.pending = null;
            entry.state.value = 'proceeding';
            if (pending) runNavigation(pending, entry);
            entry.state.value = 'unblocked';
        },
        reset: () => {
            entry.pending = null;
            entry.state.value = 'unblocked';
        },
    };
}

// ─── Components ──────────────────────────────────────────────────────────────

export interface RouteProps {
    path: string;
    children?: Renderable;
}

export interface RouteDefinition {
    path?: string;
    index?: boolean;
    component?: () => Renderable;
    redirect?: string;
    pending?: Renderable | (() => Renderable);
    error?: (error: unknown, reset: () => void) => Renderable;
    children?: RouteDefinition[];
}

export interface RouteMatch {
    route: RouteDefinition;
    params: Record<string, string>;
    pathname: string;
}

function splitPath(path: string) {
    return path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
}

function matchPattern(pattern: string, segments: string[], start: number) {
    const parts = splitPath(pattern);
    const params: Record<string, string> = {};
    let index = pattern.startsWith('/') ? 0 : start;

    for (const part of parts) {
        if (part === '*') {
            params['*'] = decodeURIComponent(segments.slice(index).join('/'));
            index = segments.length;
            break;
        }

        const optional = part.startsWith(':') && part.endsWith('?');
        const dynamic = part.startsWith(':');
        const segment = segments[index];
        if (segment == null) {
            if (optional) continue;
            return null;
        }

        if (dynamic) {
            params[part.slice(1, optional ? -1 : undefined)] = decodeURIComponent(segment);
        } else if (part !== segment) {
            return null;
        }
        index++;
    }

    return { index, params };
}

export function matchRoutes(routes: RouteDefinition[], location: string): RouteMatch[] | null {
    const pathname = new URL(location, 'http://frames.local').pathname;
    const segments = splitPath(pathname);

    const walk = (
        candidates: RouteDefinition[],
        start: number,
        parentParams: Record<string, string>,
    ): RouteMatch[] | null => {
        for (const route of candidates) {
            if (route.index && start !== segments.length) continue;
            const matched = route.index
                ? { index: start, params: {} }
                : matchPattern(route.path ?? '', segments, start);
            if (!matched) continue;

            const params = { ...parentParams, ...matched.params };
            const match: RouteMatch = {
                route,
                params,
                pathname: `/${segments.slice(0, matched.index).join('/')}`,
            };
            const children = route.children
                ? walk(route.children, matched.index, params)
                : null;

            if (children) return [match, ...children];
            if (matched.index === segments.length) return [match];
        }
        return null;
    };

    return walk(routes, 0, {});
}

function renderMatches(matches: RouteMatch[], fallback: Renderable, index = 0): Renderable {
    if (index >= matches.length) return fallback;
    const match = matches[index];
    const child = () => renderMatches(matches, fallback, index + 1);

    return ParamsContext.Provider({
        value: match.params,
        children: () => OutletContext.Provider({
            value: child,
            children: () => {
                const render = () => {
                    if (match.route.redirect) {
                        queueMicrotask(() => navigate(match.route.redirect!, true));
                        return document.createComment('redirect');
                    }
                    return match.route.component?.() ?? child();
                };
                const guarded = () => match.route.error
                    ? ErrorBoundary({ children: render, fallback: match.route.error })
                    : render();

                return match.route.pending
                    ? Suspense({ children: guarded, fallback: match.route.pending })
                    : guarded();
            },
        }),
    });
}

export function Router(props: { routes: RouteDefinition[]; fallback?: Renderable }) {
    return () => {
        const matches = matchRoutes(props.routes, currentPath.value);
        return matches ? renderMatches(matches, null) : props.fallback ?? null;
    };
}

export function Outlet() {
    return useContext(OutletContext) ?? null;
}

export const useOutlet = Outlet;

export function useParams() {
    return useContext(ParamsContext) ?? {};
}

export function searchParams() {
    return new URL(currentPath.value, 'http://frames.local').searchParams;
}

export function Redirect(props: { to: string; replace?: boolean }) {
    queueMicrotask(() => navigate(props.to, props.replace ?? true));
    return document.createComment('redirect');
}

/**
 * Conditionally renders its children when the current path matches.
 */
export function Route(props: RouteProps) {
    // Return a function so `insert()` wraps it in an effect natively!
    return () => {
        if (new URL(currentPath.value, 'http://frames.local').pathname === props.path) {
            return typeof props.children === 'function' ? props.children() : props.children;
        }
        return null;
    };
}

export interface LinkProps {
    to: string;
    class?: string;
    className?: string;
    children: Renderable;
    target?: string;
    download?: string | boolean;
}

/**
 * An anchor tag that intercepts clicks for client-side navigation.
 */
export function Link(props: LinkProps) {
    const handleClick = (e: MouseEvent) => {
        if (
            e.defaultPrevented ||
            e.button !== 0 ||
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey ||
            props.target && props.target !== '_self' ||
            props.download
        ) return;

        const url = new URL(props.to, window.location.href);
        if (url.origin !== window.location.origin) return;

        e.preventDefault();
        navigate(`${url.pathname}${url.search}${url.hash}`);
    };

    // Return a raw anchor element. 
    // We can't easily use JSX here without creating a circular dependency with the compiler's own output,
    // so we construct it manually using our primitives.
    const el = document.createElement('a');
    
    // We bind the href reactively just in case `props.to` changes dynamically
    effect(() => {
        el.href = props.to;
        const className = props.class ?? props.className;
        if (className) el.className = className;
        if (props.target) el.target = props.target;
        if (props.download) el.download = typeof props.download === 'string' ? props.download : '';
    });

    el.addEventListener('click', handleClick);
    onCleanup(() => el.removeEventListener('click', handleClick));
    
    // Insert children
    insert(el, props.children);
    
    return el;
}
