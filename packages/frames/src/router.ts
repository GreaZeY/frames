import { state, effect } from './reactivity';
import { insert } from './runtime';
import type { Renderable } from './runtime';

// ─── Global Router State ─────────────────────────────────────────────────────

// Only run in the browser
const isBrowser = typeof window !== 'undefined';
const getLocationPath = () =>
    `${window.location.pathname}${window.location.search}${window.location.hash}`;
export const currentPath = state(isBrowser ? getLocationPath() : '/');

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

/**
 * Conditionally renders its children when the current path matches.
 */
export function Route(props: RouteProps) {
    // Return a function so `insert()` wraps it in an effect natively!
    return () => {
        if (currentPath.value === props.path) {
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
    
    // Insert children
    insert(el, props.children);
    
    return el;
}
