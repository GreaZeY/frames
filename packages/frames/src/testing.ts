import { mount } from './runtime';
import type { Renderable } from './runtime';

export function render(component: () => Renderable) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const dispose = mount(component, container);
    return {
        container,
        unmount: () => {
            dispose();
            container.remove();
        },
    };
}
