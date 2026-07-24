const delegatedEvents = new Set<string>();

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
