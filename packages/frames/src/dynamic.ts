import { bindEvent, isDelegatedEvent } from './events';
import { effect } from './reactivity';
import { bindRef, insert, setProperty } from './runtime';
import type { Ref, Renderable } from './runtime';

export type DynamicComponent<P extends Record<string, unknown> = Record<string, unknown>> =
    | string
    | ((props: P) => Renderable);

export type DynamicProps = Record<string, unknown> & {
    component: DynamicComponent;
    children?: Renderable;
};

function forwardedProps(props: DynamicProps) {
    const forwarded: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
        if (key === 'component') continue;
        Object.defineProperty(forwarded, key, {
            configurable: true,
            enumerable: true,
            get: () => props[key],
        });
    }
    return forwarded;
}

function nativeElement(tag: string, props: Record<string, unknown>) {
    const element = document.createElement(tag);

    for (const key of Object.keys(props)) {
        if (key === 'children') continue;
        if (key === 'ref') {
            bindRef(element, () => props.ref as Ref<Element>);
        } else if (/^on[A-Z]/.test(key)) {
            const eventName = key.slice(2).toLowerCase();
            bindEvent(
                element,
                eventName,
                () => props[key] as ((event: Event) => void) | undefined,
                isDelegatedEvent(eventName),
            );
        } else {
            effect(() => setProperty(element, key, props[key]));
        }
    }

    if (props.children !== undefined) insert(element, props.children as Renderable);
    return element;
}

export function Dynamic(props: DynamicProps): Renderable {
    const forwarded = forwardedProps(props);

    return () => {
        const component = props.component;
        return typeof component === 'string'
            ? nativeElement(component, forwarded)
            : component(forwarded);
    };
}
