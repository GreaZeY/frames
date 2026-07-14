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
    let node = (e.composedPath && e.composedPath()[0]) || e.target;
    
    // Reverse traverse the DOM path
    if (e.composedPath) {
        for (const n of e.composedPath()) {
            if (n && (n as any)[key]) {
                (n as any)[key](e);
                if (e.cancelBubble) return;
            }
        }
    } else {
        // Fallback for older browsers
        while (node) {
            if ((node as any)[key]) {
                (node as any)[key](e);
                if (e.cancelBubble) return;
            }
            node = (node as Node).parentNode;
        }
    }
}
