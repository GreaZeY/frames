import { effect, onCleanup } from './reactivity';

const delegatedEvents = new Set<string>();
const nonBubblingEvents = new Set([
    'mouseenter', 'mouseleave', 'load', 'unload', 'scroll', 'focus', 'blur', 'error',
]);

export const isDelegatedEvent = (eventName: string) => !nonBubblingEvents.has(eventName);

export type EventHandler<E extends Event = Event> = ((event: E) => void) | null | undefined;

export function bindEvent<E extends Event>(
    element: Element,
    eventName: string,
    handler: () => EventHandler<E>,
    delegated = true,
) {
    const key = `$$${eventName}`;

    if (delegated) {
        delegateEvent(eventName);
        effect(() => {
            (element as Element & Record<string, unknown>)[key] = handler();
        });
        onCleanup(() => Reflect.deleteProperty(element, key));
        return;
    }

    let current = handler();
    const listener = (event: Event) => current?.call(element, event as E);
    element.addEventListener(eventName, listener);
    effect(() => {
        current = handler();
    });
    onCleanup(() => element.removeEventListener(eventName, listener));
}

export function delegateEvent(eventName: string) {
    // Only register the global listener once per event type
    if (delegatedEvents.has(eventName)) return;
    delegatedEvents.add(eventName);

    // Attach to document with standard bubbling phase
    if (typeof document !== 'undefined') {
        document.addEventListener(eventName, globalEventHandler);
    }
}

function globalEventHandler(e: Event) {
    const key = `$$${e.type}`;
    const path = e.composedPath?.();
    let node: EventTarget | null = path?.[0] || e.target;

    const invoke = (target: EventTarget) => {
        const handler = (target as EventTarget & Record<string, unknown>)[key];
        if (typeof handler !== 'function') return;

        Object.defineProperty(e, 'currentTarget', {
            configurable: true,
            value: target,
        });
        try {
            handler.call(target, e);
        } finally {
            Reflect.deleteProperty(e, 'currentTarget');
        }
    };

    // Reverse traverse the DOM path
    if (path) {
        for (const target of path) {
            invoke(target);
            if (e.cancelBubble) return;
        }
    } else {
        // Fallback for older browsers
        while (node) {
            invoke(node);
            if (e.cancelBubble) return;
            node = node instanceof Node ? node.parentNode : null;
        }
    }
}
