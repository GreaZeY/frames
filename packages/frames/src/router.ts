import { state, effect, onCleanup } from './reactivity';
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

export function navigate(path: string, replace = false) {
    if (!isBrowser) return;
    
    if (replace) {
        window.history.replaceState({}, '', path);
    } else {
        window.history.pushState({}, '', path);
    }
    currentPath.value = getLocationPath();
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
        if (props.class) el.className = props.class;
        if (props.target) el.target = props.target;
        if (props.download) el.download = typeof props.download === 'string' ? props.download : '';
    });

    el.addEventListener('click', handleClick);
    onCleanup(() => el.removeEventListener('click', handleClick));
    
    // Insert children
    insert(el, props.children);
    
    return el;
}
