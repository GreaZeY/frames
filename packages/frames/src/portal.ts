import { onCleanup } from './reactivity';
import { insert } from './runtime';
import type { Renderable } from './runtime';

export interface PortalProps {
    mount?: Node;
    children?: Renderable;
}

/**
 * Renders its children into a different part of the DOM (defaults to document.body).
 * The portal maintains the reactive context of where it was rendered, meaning
 * all state and effects continue to work normally.
 */
export function Portal(props: PortalProps) {
    const target = props.mount || (typeof document !== 'undefined' ? document.body : null);
    if (!target) return null;
    
    // We use a wrapper with display: contents to cleanly group and remove
    // portal children without affecting CSS grid or flexbox layouts.
    const wrapper = document.createElement("div");
    wrapper.style.display = "contents";
    target.appendChild(wrapper);
    
    // Insert the reactive children into the wrapper
    insert(wrapper, props.children);
    
    // When the component that rendered the <Portal> unmounts,
    // this cleanup function removes the entire wrapper from the DOM.
    onCleanup(() => {
        if (wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
        }
    });
    
    // Return a placeholder comment for the original DOM location
    return document.createComment("portal-placeholder");
}
