import { state, derived, effect } from './reactivity';
import { insert } from './runtime';

// ─── Global Router State ─────────────────────────────────────────────────────

// Only run in the browser
const isBrowser = typeof window !== 'undefined';
export const currentPath = state(isBrowser ? window.location.pathname : '/');

if (isBrowser) {
    window.addEventListener('popstate', () => {
        currentPath.value = window.location.pathname;
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
    currentPath.value = path;
}

// ─── Components ──────────────────────────────────────────────────────────────

export interface RouteProps {
    path: string;
    children?: any;
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
    children: any;
    [key: string]: any;
}

/**
 * An anchor tag that intercepts clicks for client-side navigation.
 */
export function Link(props: LinkProps) {
    const handleClick = (e: MouseEvent) => {
        e.preventDefault();
        navigate(props.to);
    };

    // Return a raw anchor element. 
    // We can't easily use JSX here without creating a circular dependency with the compiler's own output,
    // so we construct it manually using our primitives.
    const el = document.createElement('a');
    
    // We bind the href reactively just in case `props.to` changes dynamically
    effect(() => {
        el.href = props.to;
        if (props.class) el.className = props.class;
    });

    el.addEventListener('click', handleClick);
    
    // Insert children
    insert(el, props.children);
    
    return el;
}
